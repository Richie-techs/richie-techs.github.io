const shipments = {
  "ST-2048-7319": {
    status:"In transit", origin:"Accra", originCountry:"Ghana", dest:"Kumasi", destCountry:"Ghana",
    eta:"Oct 31, 2026", service:"Express delivery", packageType:"General goods", updated:"Oct 29, 2026 · 1:20 PM", current:2,
    steps:[
      ["Shipment booked","Your shipping details have been received.","Oct 27, 2026 · 9:10 AM"],
      ["Picked up","The package was collected from the sender.","Oct 27, 2026 · 2:45 PM"],
      ["In transit","Your goods are moving through the delivery network.","Oct 29, 2026 · 1:20 PM"],
      ["Out for delivery","The courier is on the way to the recipient.","Expected Oct 31"],
      ["Delivered","The shipment has reached its destination.","Pending"]
    ]
  },
  "ST-8851-2046": {
    status:"Delivered", origin:"Tema", originCountry:"Ghana", dest:"Takoradi", destCountry:"Ghana",
    eta:"Oct 28, 2026", service:"Standard delivery", packageType:"Documents", updated:"Oct 28, 2026 · 4:35 PM", current:4,
    steps:[
      ["Shipment booked","Your shipping details have been received.","Oct 25, 2026 · 8:05 AM"],
      ["Picked up","The package was collected from the sender.","Oct 25, 2026 · 11:30 AM"],
      ["In transit","The shipment moved through the delivery network.","Oct 26, 2026 · 7:15 PM"],
      ["Out for delivery","The courier was on the way to the recipient.","Oct 28, 2026 · 10:20 AM"],
      ["Delivered","The shipment was delivered successfully.","Oct 28, 2026 · 4:35 PM"]
    ]
  }
};
const form=document.getElementById('trackingForm'), input=document.getElementById('trackingInput');
function track(id){
  const key=id.trim().toUpperCase(), data=shipments[key], error=document.getElementById('errorMessage'), result=document.getElementById('result');
  if(!data){error.classList.add('show');result.classList.remove('show');return;}
  error.classList.remove('show');
  document.getElementById('resultId').textContent=key;
  document.getElementById('statusPill').innerHTML='<span class="status-dot"></span> '+data.status;
  document.getElementById('originCity').textContent=data.origin;
  document.getElementById('originCountry').textContent=data.originCountry;
  document.getElementById('destCity').textContent=data.dest;
  document.getElementById('destCountry').textContent=data.destCountry;
  document.getElementById('eta').textContent=data.eta;
  document.getElementById('service').textContent=data.service;
  document.getElementById('packageType').textContent=data.packageType;
  document.getElementById('updated').textContent=data.updated;
  document.getElementById('timelineSteps').innerHTML=data.steps.map((s,i)=>`<div class="step ${i<data.current?'done':i===data.current?'current':''}"><div class="step-icon"></div><div><strong>${s[0]}</strong><p>${s[1]}</p><time>${s[2]}</time></div></div>`).join('');
  result.classList.add('show');
  result.scrollIntoView({behavior:'smooth',block:'start'});
}
form.addEventListener('submit',e=>{e.preventDefault();track(input.value);});
document.getElementById('demoLink').addEventListener('click',e=>{e.preventDefault();input.value='ST-2048-7319';track(input.value);});
