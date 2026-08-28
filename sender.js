const colors = {
    '00': 'rgb(255, 0, 0)',
    '01': 'rgb(0, 255, 0)',
    '10': 'rgb(0, 0, 255)',
    '11': 'rgb(255, 255, 255)',
    'SEP': 'rgb(0, 0, 0)'
};

function add_hammcode(str) {// take str and add hamming code
    let arr = new Array(31).fill(0); 
    let idx = 0;

    for (let i = 1; i <= 30; i++) {
        if (i == 1 || i == 2 || i == 4 || i == 8 || i == 16) continue;
        arr[i] = parseInt(str[idx++]);
    }

    for (let i = 1; i <= 30; i++) {
        if (arr[i] == 1) {
            arr[1] ^= (i & 1) ? 1 : 0;
            arr[2] ^= (i & 2) ? 1 : 0;
            arr[4] ^= (i & 4) ? 1 : 0;
            arr[8] ^= (i & 8) ? 1 : 0;
            arr[16] ^= (i & 16) ? 1 : 0;
        }
    }
    return arr.slice(1).join('');
}

let box = document.getElementById('box');
let stat = document.getElementById('stat');
let btn = document.getElementById('snd_btn');
let origInp = document.getElementById('orig_val');
let corrInp = document.getElementById('corr_val');
let spdInp = document.getElementById('spd');

box.onclick = function() {
    if (box.requestFullscreen) box.requestFullscreen();
    else if (box.webkitRequestFullscreen) box.webkitRequestFullscreen();
};
let isBusy = false;

btn.onclick = async function() {
    if (isBusy) return;

    let original = origInp.value; let corrupted = corrInp.value;
    let speed = parseInt(spdInp.value);
    
    //// checking the input 
    if (original.length != corrupted.length || original.length == 0 || original.length > 20) {
        alert("Invalid lengths. Max 20 bits.");
        return;
    }
    let errs = 0;
    for(let i=0; i<original.length; i++) { if (original[i] != corrupted[i]) errs++; }
    if (errs > 1) {alert("Max 1 bit error allowed!");return;}
    ////

    isBusy = true;
    btn.disabled = true;
    let lenB = original.length.toString(2).padStart(5, '0'); // convert org length to binary string and 0pad to 5 digits
    let pOrig = original.padEnd(20, '0');
    let pCorr = corrupted.padEnd(20, '0');
    
    let p1 = lenB + pOrig;
    let p2 = lenB + pCorr;
    let pckt30 = add_hammcode(p1); // data + len + hamming
    
    let err_pos = -1;
    for (let i = 0; i < 25; i++) {
        if (p1[i] != p2[i]) {
            err_pos = i;
            break;
        }
    }
    
    if (err_pos != -1) {
        let data_idx = [];
        for (let i = 1; i <= 30; i++) {
            if (i == 1 || i == 2 || i == 4 || i == 8 || i == 16) continue;
            data_idx.push(i - 1);
        }
        let flip_idx = data_idx[err_pos];
        let tmp = pckt30.split('');
        tmp[flip_idx] = tmp[flip_idx] == '1' ? '0' : '1'; // flip the bit in pckt30's blueprint
        pckt30 = tmp.join(''); // update pckt30 with the new flipped bit in data
    }
    
    let sync = '00011011';
    let frame = sync + pckt30;

    let seq = [];
    for (let i = 0; i < frame.length; i += 2) {
        seq.push('SEP');
        seq.push(frame.substring(i, i+2));
    }
    seq.push('SEP');


    // now we can send the msg...
    let wait = ms => new Promise(r => setTimeout(r, ms));
    
    box.style.background = colors['SEP'];
    box.innerHTML = "";
    
    for (let i = 5; i > 0; i--) { // wait 5 sec
        stat.innerHTML = "Starts in " + i; await wait(1000);
    }
    stat.innerHTML = "Sending...";
    for (let i=0; i<seq.length; i++) { ///flash colors
        box.style.background = colors[seq[i]];
        await wait(speed);
    }
    
    box.style.background = colors['SEP'];
    stat.innerHTML = "Done";
    isBusy = false;
    btn.disabled = false;
};