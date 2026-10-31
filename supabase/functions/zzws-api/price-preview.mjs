// Preview describes raw file prices; it never applies a client policy or changes the import.
export function pricePreview(products){
 const priced=products.filter(p=>p.ws>0||p.kp>0||p.kpPromo>0);
 return {count:products.length,sample:(priced.length?priced:products).slice(0,5),sampleMode:priced.length?'priced':'first',priceSummary:{ws:products.filter(p=>p.ws>0).length,kp:products.filter(p=>p.kp>0).length,kpPromo:products.filter(p=>p.kpPromo>0).length,withWholesale:priced.length,withoutWholesale:products.length-priced.length}};
}

