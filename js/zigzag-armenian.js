// Presentation-only translations. Source values and filtering remain unchanged.
(() => {
  const key = value => String(value).toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  const names = {
    'Nominal power (4 Ohms) (W)':'Անվանական հզորություն՝ 4 Օմ (Վտ)','Nominal power (6 Ohms) (W)':'Անվանական հզորություն՝ 6 Օմ (Վտ)',
    Type:'Տեսակ','Housing material':'Կորպուսի նյութ',Material:'Նյութ','Cord length (m)':'Լարի երկարություն (մ)',Quantity:'Քանակ','Size (cm)':'Չափս (սմ)',
    'Bluetooth Built-in Мodule':'Ներկառուցված Bluetooth','USB port':'USB միացք','Battery operation (Till/hr)':'Մարտկոցով աշխատանք (մինչև ժամ)','Volume(l)':'Ծավալ (լ)',
    'Diameter (cm)':'Տրամագիծ (սմ)','Water Tank Capacity(l)':'Ջրի տարայի ծավալ (լ)','Battery type':'Մարտկոցի տեսակ','Built-in Microphone':'Ներկառուցված խոսափող',
    'Number of speeds':'Արագությունների քանակ','Number of Nozzles':'Գլխադիրների քանակ','Cable Type':'Մալուխի տեսակ','Frequency range (Hz)':'Հաճախականության միջակայք (Հց)',
    'Built-in Memory (ROM)':'Ներկառուցված հիշողություն (ROM)','Operative memory (RAM)':'Օպերատիվ հիշողություն (RAM)',Covering:'Ծածկույթ','Remote control':'Հեռակառավարում',
    'CPU type':'Պրոցեսորի տեսակ','Operating voltage':'Աշխատանքային լարում','Battery charging time (hr)':'Մարտկոցի լիցքավորման ժամանակ (ժ)','Type of connection':'Միացման տեսակ',
    'CPU Manufacturer':'Պրոցեսորի արտադրող','Sensitivity (dB)':'Զգայունություն (դԲ)','Power consumption (W)':'Սպառվող հզորություն (Վտ)','Headset type':'Ականջակալի տեսակ',
    'Front Speakers Power (W)':'Առջևի բարձրախոսների հզորություն (Վտ)','Resistance(Om)':'Դիմադրություն (Օմ)',Usage:'Կիրառություն','Number of Cores':'Միջուկների քանակ',
    'Bowl Capacity (l)':'Ամանի ծավալ (լ)','Nominal power (8 Ohms) (W)':'Անվանական հզորություն՝ 8 Օմ (Վտ)','Number of channels':'Ալիքների քանակ','Volume control':'Ձայնի կարգավորում',
    Manufacturer:'Արտադրող',Warranty:'Երաշխիք',Color:'Գույն',Colour:'Գույն',
    'Load Capacity (kg)':'Տարողություն (կգ)','Capacity (kg)':'Տարողություն (կգ)',
    'Spin Speed (RPM)':'Քամման արագություն (պտ/րոպե)','Energy Rating':'Էներգախնայողության դաս',
    'Noise level (dB)':'Աղմուկի մակարդակ (դԲ)','Noise level during spinning (dB)':'Աղմուկը քամելու ընթացքում (դԲ)',
    'Washing programs':'Լվացման ծրագրեր','Motor type':'Շարժիչի տեսակ','Мotor type':'Շարժիչի տեսակ',
    'Control Type':'Կառավարման տեսակ',Display:'Էկրան','Weight (kg)':'Քաշ (կգ)',Weight:'Քաշ',
    'Washing class':'Լվացման դաս','Spinning class':'Քամման դաս','Door opening direction':'Դռան բացման ուղղություն',
    'Protection from children':'Պաշտպանություն երեխաներից','Auto-OFF':'Ավտոմատ անջատում',
    'Dimensions(HxWxD)':'Չափսեր՝ Բ × Լ × Խ','Dimensions(WxDxH)':'Չափսեր՝ Լ × Խ × Բ',Dimensions:'Չափսեր',
    'Width (cm)':'Լայնություն (սմ)','Depth (cm)':'Խորություն (սմ)','Height (cm)':'Բարձրություն (սմ)',
    'Width (mm)':'Լայնություն (մմ)','Depth (mm)':'Խորություն (մմ)','Height (mm)':'Բարձրություն (մմ)',
    'Steam Refresh':'Գոլորշիով թարմացում','Steam Cleaning':'Գոլորշիով մաքրում',
    'Delayed start (hr)':'Հետաձգված մեկնարկ (ժ)','Leak protection':'Պաշտպանություն արտահոսքից',
    Thermostat:'Թերմոստատ','Energy consumption per cycle (kWh)':'Էներգիայի սպառում մեկ ցիկլում (կՎտժ)',
    'Wi-Fi Capability':'Wi-Fi կապ','Temperature range(°C)':'Ջերմաստիճանի միջակայք (°C)',
    'Digital tuner':'Թվային ռադիոընդունիչ',Tuner:'Ռադիոընդունիչ',
    'Screen Size':'Էկրանի չափ','Screen size (inch)':'Էկրանի չափ (դյույմ)',Diagonal:'Անկյունագիծ',
    'Resolution (px)':'Թույլատրելիություն (փիքսել)',Resolution:'Թույլատրելիություն',
    'Refresh Rate (Hz)':'Թարմացման հաճախականություն (Հց)','Refresh Rate':'Թարմացման հաճախականություն',
    'Screen Type':'Էկրանի տեսակ','Smart TV':'Խելացի հեռուստացույց','Operating System':'Օպերացիոն համակարգ',
    'Total Power (W)':'Ընդհանուր հզորություն (Վտ)','Power (W)':'Հզորություն (Վտ)',Power:'Հզորություն',
    'Battery Capacity (mAh)':'Մարտկոցի տարողություն (մԱժ)',Bluetooth:'Bluetooth կապ',
    'Memory (GB)':'Հիշողություն (ԳԲ)',Memory:'Հիշողություն',Processor:'Պրոցեսոր',
    'RAM (GB)':'Օպերատիվ հիշողություն (ԳԲ)','Internal Memory (GB)':'Ներքին հիշողություն (ԳԲ)',
    'Number of SIM Cards':'SIM քարտերի քանակ','Main Camera':'Հիմնական տեսախցիկ',
    'Number of Speakers':'Բարձրախոսների քանակ','Total Capacity (L)':'Ընդհանուր տարողություն (լ)',
    'Freezer Capacity (L)':'Սառցարանի տարողություն (լ)','Refrigerator Capacity (L)':'Սառնարանի տարողություն (լ)',
    'Defrosting System':'Հալեցման համակարգ','Installation Type':'Տեղադրման տեսակ',
    'Drying Capacity (kg)':'Չորացման տարողություն (կգ)','Number of Programs':'Ծրագրերի քանակ'
  };
  const translations=Object.fromEntries(Object.entries(names).map(([name,value])=>[key(name),value]));
  const values={yes:'Այո',no:'Ոչ',white:'Սպիտակ',black:'Սև',silver:'Արծաթագույն',graphite:'Գրաֆիտ',grey:'Մոխրագույն',gray:'Մոխրագույն',red:'Կարմիր',blue:'Կապույտ',green:'Կանաչ',gold:'Ոսկեգույն',inverter:'Ինվերտորային',left:'Ձախ',right:'Աջ',mechanical:'Մեխանիկական',sensory:'Սենսորային',electronic:'Էլեկտրոնային',manual:'Ձեռքով',automatic:'Ավտոմատ'};
  const value = raw => String(raw).split(/(\s*\/\s*)/).map(part=>values[part.toLowerCase()]||part).join('')
    .replace(/\bmonths?\b/gi,'ամիս').replace(/\byears?\b/gi,'տարի').replace(/\bcm\b/g,'սմ').replace(/\bmm\b/g,'մմ').replace(/\bkg\b/g,'կգ');
  window.ZZWS_ARMENIAN_SPECS=Object.freeze({label:raw=>translations[key(raw)]||String(raw),value});
})();
