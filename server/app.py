import getpass
import hashlib
import io
import json
import os
from pathlib import Path
import secrets
import sqlite3
import time
from functools import wraps

from flask import Flask, abort, g, jsonify, request, send_file, send_from_directory
from werkzeug.exceptions import HTTPException
from werkzeug.security import check_password_hash, generate_password_hash
from openpyxl import Workbook
from server.catalog import parse_price, project

ROOT = Path(__file__).resolve().parents[1]


def create_app(data_dir=None, testing=False):
    app = Flask(__name__, static_folder=None)
    storage = Path(data_dir or os.environ.get('ZZWS_DATA_DIR', ROOT / 'private-data')).resolve()
    storage.mkdir(parents=True, exist_ok=True)
    app.config.update(MAX_CONTENT_LENGTH=10_000_000, TESTING=testing)
    origin = os.environ.get('ZZWS_ORIGIN', 'http://127.0.0.1:8080').rstrip('/')
    secure = origin.startswith('https://')
    if not testing and not secure and origin != 'http://127.0.0.1:8080':
        raise RuntimeError('Для публикации нужен HTTPS в ZZWS_ORIGIN')

    def db():
        if 'db' not in g:
            g.db = sqlite3.connect(storage / 'zzws.sqlite', timeout=30)
            g.db.row_factory = sqlite3.Row
            g.db.execute('PRAGMA foreign_keys=ON')
        return g.db

    @app.teardown_appcontext
    def close_db(error):
        if 'db' in g:
            g.db.close()

    with app.app_context():
        db().executescript('''
        CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, login TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
            profile TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
        CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS versions(id TEXT PRIMARY KEY, products TEXT NOT NULL, created REAL NOT NULL, actor TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS drafts(id TEXT PRIMARY KEY, actor TEXT NOT NULL, products TEXT NOT NULL, expires REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS user_drafts(id TEXT PRIMARY KEY, actor TEXT NOT NULL, payload TEXT NOT NULL, expires REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS attempts(ip TEXT NOT NULL, login TEXT NOT NULL, created REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, created REAL NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL);
        ''')
        db().commit()

    def audit(action, detail=''):
        db().execute('INSERT INTO audit(created,actor,action,detail) VALUES(?,?,?,?)',
                     (time.time(), getattr(g, 'uid', 'anonymous'), action, str(detail)))

    def json_body():
        payload = request.get_json()
        if not isinstance(payload, dict):
            raise ValueError('Ожидается JSON-объект')
        return payload

    def session_user():
        raw = request.cookies.get('zzws_session', '')
        token = hashlib.sha256(raw.encode()).hexdigest()
        row = db().execute('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id '
                           'WHERE token=? AND expires>? AND active=1', (token, time.time())).fetchone()
        if not row:
            abort(401)
        g.uid, g.token = row['id'], token
        return dict(json.loads(row['profile']), id=row['id'], login=row['login'], active=bool(row['active']))

    def authorized(admin=False):
        def decorate(fn):
            @wraps(fn)
            def wrapped(*args, **kwargs):
                g.user = session_user()
                if admin and g.user['role'] != 'admin':
                    abort(403)
                return fn(*args, **kwargs)
            return wrapped
        return decorate

    @app.before_request
    def protect_requests():
        if request.path.startswith('/api/') and request.method not in ('GET', 'HEAD'):
            # No CORS. A custom header prevents cross-origin form submissions; Origin is checked too.
            if request.headers.get('X-ZZWS-Request') != '1' or request.headers.get('Origin') != origin:
                abort(403)

    @app.after_request
    def headers(response):
        response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Referrer-Policy'] = 'no-referrer'
        response.headers['Content-Security-Policy'] = "frame-ancestors 'none'; object-src 'none'; base-uri 'self'"
        if secure:
            response.headers['Strict-Transport-Security'] = 'max-age=31536000'
        return response

    @app.errorhandler(HTTPException)
    def http_error(error):
        return jsonify(error={401: 'Войдите в систему', 403: 'Доступ запрещён', 429: 'Слишком много попыток. Повторите позже'}.get(error.code, error.description)), error.code

    @app.errorhandler(ValueError)
    def invalid(error):
        return jsonify(error=str(error)), 400

    @app.post('/api/login')
    def login():
        payload = json_body()
        name, password = str(payload.get('login', '')).strip().lower(), str(payload.get('password', ''))
        if len(name) > 150 or len(password) > 256:
            abort(400)
        ip = request.remote_addr or 'unknown'
        cutoff = time.time() - 900
        db().execute('DELETE FROM attempts WHERE created<?', (cutoff,))
        db().execute('DELETE FROM sessions WHERE expires<?', (time.time(),))
        db().execute('DELETE FROM drafts WHERE expires<?', (time.time(),))
        failures = db().execute('SELECT count(*) FROM attempts WHERE ip=? OR login=?', (ip, name)).fetchone()[0]
        if failures >= 10:
            db().commit()
            abort(429)
        row = db().execute('SELECT * FROM users WHERE login=?', (name,)).fetchone()
        # Run the same expensive password check for unknown and disabled users.
        valid = check_password_hash(row['password'] if row else dummy_password, password)
        if not valid or not row or not row['active']:
            db().execute('INSERT INTO attempts VALUES(?,?,?)', (ip, name, time.time()))
            audit('login_failed')
            db().commit()
            abort(401)
        token = secrets.token_urlsafe(32)
        old = hashlib.sha256(request.cookies.get('zzws_session', '').encode()).hexdigest()
        db().execute('DELETE FROM sessions WHERE token=?', (old,))
        db().execute('INSERT INTO sessions VALUES(?,?,?)', (hashlib.sha256(token.encode()).hexdigest(), row['id'], time.time() + 8 * 3600))
        g.uid = row['id']
        audit('login')
        db().commit()
        response = jsonify(dict(json.loads(row['profile']), id=row['id'], login=row['login']))
        response.set_cookie('zzws_session', token, max_age=8 * 3600, secure=secure, httponly=True, samesite='Strict', path='/')
        return response

    dummy_password = generate_password_hash(secrets.token_urlsafe(32), method='scrypt')

    @app.get('/api/me')
    @authorized()
    def me():
        return jsonify(g.user)

    @app.post('/api/logout')
    @authorized()
    def logout():
        db().execute('DELETE FROM sessions WHERE token=?', (g.token,))
        audit('logout')
        db().commit()
        response = jsonify(ok=True)
        response.delete_cookie('zzws_session', path='/')
        return response

    def active_catalog():
        row = db().execute("SELECT versions.* FROM versions JOIN settings ON versions.id=settings.value WHERE settings.key='price'").fetchone()
        if not row:
            abort(409, 'Администратор ещё не опубликовал прайс')
        return row

    @app.get('/api/catalog/version')
    @authorized()
    def version():
        row = active_catalog()
        return jsonify(version=row['id'], updated=time.strftime('%d/%m/%y', time.gmtime(row['created'])))

    @app.get('/api/catalog')
    @authorized()
    def catalog():
        row = active_catalog()
        return jsonify(products=project(json.loads(row['products']), g.user), version=row['id'],
                       updated=time.strftime('%d/%m/%y', time.gmtime(row['created'])))

    @app.get('/api/catalog/export')
    @authorized()
    def export():
        row = active_catalog()
        products = project(json.loads(row['products']), g.user)
        book = Workbook()
        sheet = book.active
        def safe(value):
            return "'" + value if isinstance(value, str) and value.startswith(('=', '+', '-', '@')) else value
        sheet.append(['Получатель', safe(g.user['client']), 'Версия', row['id']])
        sheet.append(['Артикул', 'Бренд', 'Категория', 'Наименование', 'Розница', 'Ваша цена', 'Наличие'] + (['KP'] if g.user['role'] == 'admin' else []))
        for p in products:
            values = [p[k] for k in ['articul', 'brand', 'category', 'name', 'retail', 'wholesale', 'stockStatus']]
            if g.user['role'] == 'admin':
                values.append(p['kpPrice'])
            sheet.append([safe(v) for v in values])
        output = io.BytesIO()
        book.save(output)
        output.seek(0)
        audit('export', row['id'])
        db().commit()
        return send_file(output, download_name='PriceList.xlsx', as_attachment=True,
                         mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

    @app.post('/api/admin/price/preview')
    @authorized(admin=True)
    def preview_price():
        upload = request.files.get('file')
        if not upload or not upload.filename.lower().endswith('.xlsx'):
            raise ValueError('Выберите XLSX-файл')
        products = parse_price(upload.read())
        draft = secrets.token_urlsafe(24)
        db().execute('INSERT INTO drafts VALUES(?,?,?,?)', (draft, g.uid, json.dumps(products, ensure_ascii=False), time.time() + 1800))
        audit('price_preview', len(products))
        db().commit()
        return jsonify(draft=draft, count=len(products), sample=products[:5])

    @app.post('/api/admin/price/publish')
    @authorized(admin=True)
    def publish_price():
        draft_id = json_body().get('draft')
        draft = db().execute('SELECT * FROM drafts WHERE id=? AND actor=? AND expires>?', (draft_id, g.uid, time.time())).fetchone()
        if not draft:
            abort(404, 'Проверка истекла. Загрузите файл заново')
        stamp = secrets.token_hex(12)
        db().execute('INSERT INTO versions VALUES(?,?,?,?)', (stamp, draft['products'], time.time(), g.uid))
        db().execute("INSERT OR REPLACE INTO settings VALUES('price',?)", (stamp,))
        db().execute('DELETE FROM drafts WHERE id=?', (draft_id,))
        audit('price_publish', stamp)
        db().commit()
        return jsonify(version=stamp)

    @app.get('/api/admin/price/versions')
    @authorized(admin=True)
    def versions():
        active = db().execute("SELECT value FROM settings WHERE key='price'").fetchone()
        return jsonify(active=active[0] if active else None, versions=[dict(r) for r in db().execute('SELECT id,created,actor FROM versions ORDER BY created DESC LIMIT 100')])

    @app.post('/api/admin/price/rollback')
    @authorized(admin=True)
    def rollback():
        version_id = json_body().get('version')
        if not db().execute('SELECT id FROM versions WHERE id=?', (version_id,)).fetchone():
            abort(404)
        db().execute("INSERT OR REPLACE INTO settings VALUES('price',?)", (version_id,))
        audit('price_rollback', version_id)
        db().commit()
        return jsonify(ok=True)

    def validate_user(payload):
        login = str(payload.get('login', '')).strip().lower()
        client = str(payload.get('client', '')).strip()
        if not login or len(login) > 150 or not client or len(client) > 200:
            raise ValueError('Укажите логин и название клиента')
        role, sheet = payload.get('role', 'client'), payload.get('sheet', 'Dealers')
        if role not in ['admin', 'client'] or sheet not in ['Dealers', 'KP']:
            raise ValueError('Неверная роль или группа цен')
        brands = payload.get('brands', [])
        if not isinstance(brands, list) or not all(isinstance(b, str) and len(b) < 100 for b in brands):
            raise ValueError('Неверный список брендов')
        rows = payload.get('rowsList', [])
        if not isinstance(rows, list) or len(rows) > 5 or any(not isinstance(r, dict) or any(not isinstance(v, str) or len(v) > 300 for v in r.values()) for r in rows):
            raise ValueError('Неверные контактные данные')
        return login, dict(client=client, role=role, sheet=sheet, brands=brands, allBrands=payload.get('allBrands') is True,
                           allowResale=payload.get('allowResale') is True, rowsList=rows or [dict(organization=client, address='', contact='')])

    @app.get('/api/admin/users')
    @authorized(admin=True)
    def users():
        return jsonify(users=[dict(json.loads(r['profile']), id=r['id'], login=r['login'], active=bool(r['active'])) for r in db().execute('SELECT * FROM users ORDER BY login')])

    @app.post('/api/admin/users')
    @authorized(admin=True)
    def save_user():
        payload = json_body()
        login_name, profile = validate_user(payload)
        uid = payload.get('id') or secrets.token_hex(16)
        old = db().execute('SELECT * FROM users WHERE id=?', (uid,)).fetchone()
        password = str(payload.get('password', ''))
        if (not old or password) and not 12 <= len(password) <= 256:
            raise ValueError('Новый пароль должен содержать от 12 до 256 символов')
        active = payload.get('active', True) is True
        # Prevent accidental loss of the administrator currently performing the update.
        if uid == g.uid and (not active or profile['role'] != 'admin'):
            raise ValueError('Нельзя заблокировать себя или снять собственные права администратора')
        hashed = generate_password_hash(password, method='scrypt') if password else old['password']
        try:
            db().execute('INSERT INTO users VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET login=excluded.login,password=excluded.password,profile=excluded.profile,active=excluded.active',
                         (uid, login_name, hashed, json.dumps(profile, ensure_ascii=False), int(active)))
        except sqlite3.IntegrityError:
            raise ValueError('Этот логин уже используется')
        db().execute('DELETE FROM sessions WHERE user_id=?', (uid,))
        audit('user_update', uid)
        db().commit()
        return jsonify(id=uid)

    @app.get('/api/admin/audit')
    @authorized(admin=True)
    def audits():
        return jsonify(events=[dict(r) for r in db().execute('SELECT * FROM audit ORDER BY id DESC LIMIT 200')])

    @app.get('/api/admin/users/template')
    @authorized(admin=True)
    def user_template():
        book = Workbook()
        book.active.append(['login', 'client', 'sheet', 'brands', 'allBrands', 'organization', 'address', 'contact'])
        book.active.append(['client-example', 'Название клиента', 'Dealers', '', 'no', '', '', ''])
        output = io.BytesIO(); book.save(output); output.seek(0)
        return send_file(output, download_name='Users-template.xlsx', as_attachment=True)

    @app.post('/api/admin/users/preview')
    @authorized(admin=True)
    def preview_users():
        from server.catalog import read_rows
        upload = request.files.get('file')
        if not upload or not upload.filename.lower().endswith('.xlsx'):
            raise ValueError('Выберите XLSX по шаблону пользователей')
        rows = read_rows(upload.read())
        if not rows or [str(c or '').strip() for c in rows[0]][:3] != ['login', 'client', 'sheet']:
            raise ValueError('Используйте шаблон пользователей: login, client, sheet, brands, allBrands, organization, address, contact')
        keys = [str(c or '').strip() for c in rows[0]]
        payload, seen = [], set()
        for cells in rows[1:]:
            if not any(c is not None and c != '' for c in cells):
                continue
            source = dict(zip(keys, cells))
            source = {k: str(v or '').strip() for k,v in source.items()}
            source['brands'] = [b.strip() for b in source.get('brands','').split(',') if b.strip()]
            source['allBrands'] = source.get('allBrands','').lower() in ['yes','true','1']
            source['rowsList'] = [dict(organization=source.get('organization') or source.get('client',''), address=source.get('address',''), contact=source.get('contact',''))]
            name, profile = validate_user(source)
            if name in seen:
                raise ValueError('Повтор логина: ' + name)
            seen.add(name)
            old = db().execute('SELECT * FROM users WHERE login=?',(name,)).fetchone()
            if old and json.loads(old['profile'])['role'] == 'admin':
                raise ValueError('Импорт не может изменять администратора: ' + name)
            payload.append(dict(login=name, profile=profile, action='update' if old else 'create'))
        if not payload or len(payload) > 1000:
            raise ValueError('Допустимо от 1 до 1000 пользователей за импорт')
        draft = secrets.token_urlsafe(24)
        db().execute('DELETE FROM user_drafts WHERE expires<?',(time.time(),))
        db().execute('INSERT INTO user_drafts VALUES(?,?,?,?)',(draft,g.uid,json.dumps(payload,ensure_ascii=False),time.time()+1800))
        db().commit()
        return jsonify(draft=draft,users=[dict(login=p['login'],client=p['profile']['client'],action=p['action']) for p in payload])

    @app.post('/api/admin/users/import')
    @authorized(admin=True)
    def import_users():
        draft_id = json_body().get('draft')
        draft = db().execute('SELECT * FROM user_drafts WHERE id=? AND actor=? AND expires>?',(draft_id,g.uid,time.time())).fetchone()
        if not draft:
            abort(404, 'Проверка импорта истекла')
        for p in json.loads(draft['payload']):
            old = db().execute('SELECT * FROM users WHERE login=?',(p['login'],)).fetchone()
            if old:
                profile = json.loads(old['profile'])
                if profile['role'] == 'admin':
                    raise ValueError('Импорт не может менять администратора')
                # Import only listed metadata; preserve password, status and privileged flags.
                for key in ['client','sheet','brands','allBrands','rowsList']:
                    profile[key] = p['profile'][key]
                db().execute('UPDATE users SET profile=? WHERE id=?',(json.dumps(profile,ensure_ascii=False),old['id']))
                db().execute('DELETE FROM sessions WHERE user_id=?',(old['id'],))
            else:
                db().execute('INSERT INTO users VALUES(?,?,?,?,0)',(secrets.token_hex(16),p['login'],generate_password_hash(secrets.token_urlsafe(32),method='scrypt'),json.dumps(p['profile'],ensure_ascii=False)))
        db().execute('DELETE FROM user_drafts WHERE id=?',(draft_id,))
        audit('users_import',len(json.loads(draft['payload'])))
        db().commit()
        return jsonify(ok=True)

    @app.get('/')
    def index():
        return send_from_directory(ROOT, 'index.html')

    @app.get('/admin')
    def admin_page():
        return send_from_directory(ROOT / 'admin', 'index.html')

    @app.get('/<path:path>')
    def static_file(path):
        # Never expose the repository root, private data, work files, XLSX or archives.
        allowed = {'styles.css', 'favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'bg-warehouse-login.webp',
                   'bg-warehouse.jpg', 'logo.png', 'logo.svg', 'logo-dark.png', 'logo-dark.svg'}
        prefix = path.split('/')[0]
        if path not in allowed and not (prefix in ['js', 'help', 'admin'] and Path(path).suffix in ['.js', '.css', '.html']):
            abort(404)
        if '..' in Path(path).parts:
            abort(404)
        return send_from_directory(ROOT, path)

    @app.cli.command('create-admin')
    def create_admin():
        name = input('Логин администратора: ').strip().lower()
        password = getpass.getpass('Новый пароль (минимум 12 символов): ')
        if not name or not 12 <= len(password) <= 256:
            raise ValueError('Некорректный логин или длина пароля')
        uid = secrets.token_hex(16)
        profile = dict(client='Администратор', role='admin', sheet='Dealers', allBrands=True, brands=[], allowResale=True,
                       rowsList=[dict(organization='Администрация', address='', contact='')])
        db().execute('INSERT INTO users VALUES(?,?,?,?,1)', (uid, name, generate_password_hash(password, method='scrypt'), json.dumps(profile, ensure_ascii=False)))
        db().commit()
        print('Администратор создан. Пароль нигде не выводится.')

    return app
