// Search heuristics, NOT installation clearances. Explicit max/min/exact
// constraints are never relaxed. Units here are centimetres.
export const SIZE_SEARCH_POLICY = Object.freeze({
  washer:{width:3,depth:5,height:2},
  dryer:{width:2,depth:5,height:2},
  dishwasher:{width:1,depth:3,height:2},
  fridge:{width:5,depth:5,height:5},
  tv:{width:5,depth:2,height:5},
  laptop:{width:2,depth:2,height:.5},
  microwave:{width:3,depth:3,height:2},
  coffee:{width:2,depth:3,height:2},
  vacuum:{width:3,depth:3,height:3},
  kettle:{width:2,depth:2,height:2},
  iron:{width:2,depth:2,height:2}
});
export const SIZE_AXES = ['width','depth','height'];
const EPS = .00001;
export const dimensionMode = (state,axis) => state[axis+'Mode'] || 'max'; // Old saved conversations explicitly asked for a maximum.
export function matchDimensions(state,dimensions){
  const deviations=[];let distance=0;
  for(const field of SIZE_AXES){
    const requested=state[field];if(!requested)continue;
    const actual=dimensions[field];if(!Number.isFinite(actual))return {accepted:false,unconfirmed:true};
    const mode=dimensionMode(state,field),delta=actual-requested;
    if(mode==='max'){if(delta>EPS)return {accepted:false};continue;}
    if(mode==='min'){if(delta<-EPS)return {accepted:false};continue;}
    if(Math.abs(delta)<=.01+EPS)continue;
    if(mode==='exact')return {accepted:false};
    const categoryGap=SIZE_SEARCH_POLICY[state.category]?.[field] ?? 2;
    // For small products, do not let a fixed centimetre band become a huge percentage.
    const gap=Math.min(categoryGap,Math.max(.5,requested*.15));
    if(Math.abs(delta)>gap+EPS)return {accepted:false};
    const round=value=>Math.round(value*1000)/1000;
    deviations.push({field,requested,actual:round(actual),difference:round(delta),unit:'cm'});
    distance+=Math.abs(delta)/gap;
  }
  return {accepted:true,kind:deviations.length?'near':'exact',distance,deviations};
}
