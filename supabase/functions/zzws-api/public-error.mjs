export function publicError(error){
 const status=Number.isInteger(error?.code)&&error.code>=400&&error.code<=599?error.code:400;
 const native=error instanceof TypeError||error instanceof RangeError||error instanceof SyntaxError;
 const text=typeof error?.message==='string'?error.message:'';
 const message=status===500?'Գործողությունը չի կատարվել։ Փորձեք ավելի ուշ':!native&&/[\u0531-\u058f]/u.test(text)?text.slice(0,1200):'Հարցման տվյալները սխալ են։ Ստուգեք լրացված դաշտերը կամ ֆայլի ձևաչափը։';
 return {status,message};
}

