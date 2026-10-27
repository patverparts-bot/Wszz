"""Run on the service host; destination must be a private directory."""
import os
from pathlib import Path
import sqlite3
import sys
import time

if __name__ == '__main__':
    source = Path(os.environ.get('ZZWS_DATA_DIR', 'private-data')).resolve() / 'zzws.sqlite'
    destination = Path(sys.argv[1]).resolve()
    destination.mkdir(parents=True, exist_ok=True)
    target = destination / ('zzws-' + time.strftime('%Y%m%d-%H%M%S', time.gmtime()) + '.sqlite')
    with sqlite3.connect(f'{source.as_uri()}?mode=ro', uri=True) as src, sqlite3.connect(target) as dst:
        src.backup(dst)
    print('Private backup created:', target)
