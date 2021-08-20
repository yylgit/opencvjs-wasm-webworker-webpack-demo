require('../css/index.scss');

const Worker = require('./detectFace.worker.js');

// Scaled (reduced) image resolution for processing.
// Lesser is faster.
const PROCESSING_RESOLUTION_WIDTH = 240; // 

let worker = null;
let video = null;
let canvas = null;
let scale = 0;
let lastUpdate = 0;

let danmu = document.getElementById('danmu');

function addCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('width', width);
    canvas.setAttribute('height', height);
    canvas.style.display = 'none';
    document.body.appendChild(canvas);

    return canvas;
}

function px(value) {
    return `${value}px`;
}

function log(...args) {
    // We pass the arguments to console.log() directly. Not an "arguments array"
    // so that both of log('foo') and log('foo', 'bar') works as we expect.
    console.log(...args);

    // Also we will show the logs in the DOM.
    const el = document.createElement('p');
    el.textContent = args.join(' ');

    document.querySelector('#log').appendChild(el);
}

async function init() {
    const stream = await navigator.mediaDevices
              .getUserMedia({ video: {
                  width: 640,
                  height: 480
              }, audio: false });

    const settings = stream.getVideoTracks()[0].getSettings();
    // 如果video的width是480 则scale是0.5
    scale = PROCESSING_RESOLUTION_WIDTH / settings.width;
    // 总之canvas的width是240 对应的height是等比例缩放
    canvas = addCanvas(settings.width * scale, settings.height * scale);

    video = document.querySelector('video');
    // 但是video还是原大小 宽480
    video.setAttribute('width', settings.width);
    video.setAttribute('height', settings.height);

    video.srcObject = stream;
    await video.play();

    initWorker();
    let lastTime;
    video.addEventListener('timeupdate', function() {
        if(!lastTime) {
            lastTime = Date.now();
        } else {
            console.log(Date.now()-lastTime);
            lastTime = Date.now();
        }
        // timeupdate的时候调用也可以
        detectFaces();
        // console.log('timeupdate')
    })
}

function initWorker() {
    log('Initializing the face detection worker');

    worker = new Worker();
    worker.addEventListener('message', ({ data }) => {
        switch (data.type) {
        case 'init':
            log('Worker initialization finished. Starting face detection 🚀');
            detectFaces();
            break;
        case 'detect_faces':
            // 数据回来之后进行渲染
            requestAnimationFrame(() => {
                drawFaceFrame(data.faces);
            });
            // 这里是每次检测回来时候再次调用
            // detectFaces();
            updateFps();
            break;
        case 'log':
            log('worker👷💬', ...data.args);
            break;
        }
    });
}

function drawFaceFrame(faces) {
    // remove previous faces
    const previousFaceRects = document.querySelectorAll('.faceRect');
    previousFaceRects.forEach((el) => {
        el.parentNode.removeChild(el);
    });
    console.log(faces.length);
    const parent = document.querySelector('#videoWrapper');
    faces.forEach((face) => {
        const el = document.createElement('div');
        el.classList.add('faceRect');
        // 计算的是按照240的比例计算的 所以回来需要按比例放大
        el.style.top = px(face.y / scale);
        el.style.left = px(face.x / scale);
        el.style.width = px(face.width / scale);
        el.style.height = px(face.height / scale);

        parent.appendChild(el);
        rectMask({
            dom: danmu,
            width: video.videoWidth,
            height: video.videoheight,
            rect: {
                x:face.x / scale,
                y:face.y / scale,
                w:face.width / scale,
                h: face.height / scale
            }
        })
        
    });
}

function detectFaces() {
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    worker.postMessage({ type: 'frame', imageData }, [ imageData.data.buffer ]);
}

function updateFps() {
    const now = window.performance.now();
    const interval = now - lastUpdate;
    lastUpdate = now;

    const fps = Math.round(1000 / interval);

    document.querySelector('#fps').textContent = `${fps}FPS`;
}

init();
initDanmu();

function rectMask({
    dom,  // 设置属性的dom
    width, // dom的width
    height, // dom的height
    rect // {x,y,w,h}
  }) {
  
    // 上面矩形
    // 下边矩形
    // 左边矩形
    // 右边矩形
    let tpl = `
      <svg id="svgbg" version="1.0" xmlns="http://www.w3.org/2000/svg"
        width="${width}px" height="${height}px">
        <rect x="0" y="0" width="${width}" height="${rect.y}"/>
        <rect x="0" y="${rect.y+rect.h}" width="${width}" height="${height-(rect.y+rect.h)}"/>
        <rect x="0" y="${rect.y}" width="${rect.x}" height="${rect.h}"/>
        <rect x="${rect.x+rect.x}" y="${rect.y}" width="${width-(rect.x+rect.x)}" height="${rect.h}"/>
      </svg>
      `
      console.log(tpl)
    dom.style.setProperty('-webkit-mask-image',`url(data:image/svg+xml;base64,${window.btoa(tpl)})`)
  }


function initDanmu() {
    let danmuinner = document.getElementById('danmuinner')
    let innerHtml = ''
    for(let i=0;i<14;i++) {
        innerHtml += `<p>${ (i+'').repeat(60)}</p>`
    }
    danmuinner.innerHTML = innerHtml;
}