let video = document.getElementById('vid');
let out = document.getElementById('out');
let col_name = document.getElementById('col_name');
let camBox = document.getElementById('cam-box');

let cam_w, cam_h;

let offCanv = document.createElement('canvas');
let offDrawing = offCanv.getContext('2d', { willReadFrequently: true });

let track = null;let scale = 1;
async function start_cam() {
    let str = await navigator.mediaDevices.getUserMedia({
        video: { 
            facingMode: 'environment', width: { ideal: 4096 },
            advanced: [{ exposureMode: 'manual', whiteBalanceMode: 'manual' }] // exp lock to prevent flicker
        }});
    track = str.getVideoTracks()[0];
    video.srcObject = str;
    video.onloadedmetadata = () => {
        video.play();
        cam_w = video.videoWidth; cam_h = video.videoHeight;
        offCanv.width = cam_w; offCanv.height = cam_h;
        requestAnimationFrame(loop);};
}

document.getElementById('zoom').oninput = function(e) {
    scale = e.target.value;
    video.style.transform = "scale(" + scale + ")";
};

const COLORS = {
    'SEP': {r:0,g:0,b:0, name:'Black'},
    '00': {r:255,g:0,b:0, name:'Red'},
    '01': {r:0,g:255,b:0, name:'Green'},
    '10': {r:0,g:0,b:255, name:'Blue'},
    '11': {r:255,g:255,b:255, name:'White'}
};

let colors_modfied = structuredClone(COLORS);

let sync = false;let buffer = [];
let remaining = 0; let last_det = 'SEP';

function decodeHamming(bits) {
    bits = [0].concat(bits.split('').map(Number));
    let errorIdx = 0;

    for (let i = 1; i <= 30; i++) { if (bits[i] == 1) errorIdx ^= i;}
    let corr = false;
    if (errorIdx != 0 && errorIdx <= 30) {
        bits[errorIdx] ^= 1;corr = true;
    }

    let d = "", p = "";
    for (let i = 1; i <= 30; i++) {
        if (i==1 || i==2 || i==4 || i==8 || i==16) p += bits[i];
        else d += bits[i];
    }
    return { data: d, parity: p, corr: corr };
}

function loop() {
    if (!cam_w) { requestAnimationFrame(loop); return; }
    
    let box_w = camBox.clientWidth;
    let px = cam_w / 2;let py = cam_h / 2;
    
    let s_size = Math.floor(50 * (cam_w / box_w) / scale); // red square len
    if (s_size < 1) s_size = 1;
    
    let x1 = Math.max(0, px - s_size/2); // top left corner x coord
    let y1 = Math.max(0, py - s_size/2); // top left corner y coord
    let w1 = Math.min(cam_w - x1, s_size); // width of red square
    let h1 = Math.min(cam_h - y1, s_size); // height of red square
    
    offDrawing.drawImage(video, 0, 0, cam_w, cam_h);
    let dat = offDrawing.getImageData(x1, y1, w1, h1).data;
    
    let sumR=0, sumG=0, sumB=0, cnt=0;
    for (let i=0; i<dat.length; i+=4) { //calc avg colour
        sumR += dat[i]; sumG += dat[i+1]; sumB += dat[i+2];
        cnt++;
    }
    let avgR = sumR/cnt, avgG = sumG/cnt, avgB = sumB/cnt;
    
    let minD = 999999, colr_name = '';
    for (let colour in colors_modfied) {
        let colVec = colors_modfied[colour];
        let d = Math.sqrt((avgR-colVec.r)**2 + (avgG-colVec.g)**2 + (avgB-colVec.b)**2); // dist to colour 'colour', vector 'colVec'
        if (d < minD) { minD = d; colr_name = colour; }
    }
    
    col_name.innerHTML = COLORS[colr_name].name; // show detected col on page
    
    if (colr_name != last_det) {
        if (colr_name != 'SEP' && last_det == 'SEP') {

            if (!sync) {
                // we do color sync using preamble
                buffer.push({ n: colr_name, r: avgR, g: avgG, b: avgB });
                if (buffer.length > 4) buffer.shift();
                
                let s = "";
                for(let i=0; i<buffer.length; i++) s += buffer[i].n;
                
                if (s == '00011011') {
                    let safe = true;

                    for (let i = 0; i < buffer.length; i++) {
                        // unsafe if 4 colours differ wildly from the original ones
                        let b = COLORS[buffer[i].n];
                        if (Math.sqrt((buffer[i].r - b.r)**2 + (buffer[i].g - b.g)**2 + (buffer[i].b - b.b)**2) > 160) safe = false;
                    }

                    // modify the colors_modfied to store calibrated colors
                    if (safe) {
                        for (let i = 0; i < buffer.length; i++) {
                            colors_modfied[buffer[i].n].r = buffer[i].r;
                            colors_modfied[buffer[i].n].g = buffer[i].g;
                            colors_modfied[buffer[i].n].b = buffer[i].b;
                        }

                        sync = true;buffer = []; 
                        remaining = 15; // 15 2-bit inputs left since pcktlen is fiexed
                    }
                }

            } 

            else {
                buffer.push(colr_name);
                remaining--;
                
                if (remaining == 0) {
                    let d = decodeHamming(buffer.join(''));
                    let len_bits = d.data.substring(0, 5);
                    let len = parseInt(len_bits, 2);
                    let raw = d.data.substring(5, 5 + len); 
                    let pad = d.data.substring(5 + len, 25);
                    out.innerHTML += `<div style='border:1px dashed gray; padding: 5px; margin-bottom: 5px;'>
                    <b>Data: ${raw}</b><br>
                    Length: ${len} (${len_bits})<br>
                    Padding: ${pad}<br>
                    Parity: ${d.parity}<br>
                    ${d.corr ? `<span style='color:red;'>Fixed err </span>` : `<span style='color:green;'>No errs</span>`}
                    </div>`;
                }
            }
        }
        last_det = colr_name;
    }
    requestAnimationFrame(loop);
}
start_cam();