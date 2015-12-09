var gl;

function initGL(canvas) {
    try {
        gl = canvas.getContext("experimental-webgl");
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;
    } catch (e) {
    }
    if (!gl) {
        alert("Could not initialise WebGL, sorry :-(");
    }
}


function getShader(gl, id) {
    var shaderScript = document.getElementById(id);
    if (!shaderScript) {
        return null;
    }

    var str = "";
    var k = shaderScript.firstChild;
    while (k) {
        if (k.nodeType == 3) {
            str += k.textContent;
        }
        k = k.nextSibling;
    }

    var shader;
    if (shaderScript.type == "x-shader/x-fragment") {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (shaderScript.type == "x-shader/x-vertex") {
        shader = gl.createShader(gl.VERTEX_SHADER);
    } else {
        return null;
    }

    gl.shaderSource(shader, str);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(shader));
        return null;
    }

    return shader;
}


var shaderProgram;

function initShaders() {
    var fragmentShader = getShader(gl, "fshader");
    var vertexShader = getShader(gl, "vshader");

    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Could not initialise shaders");
    }

    gl.useProgram(shaderProgram);

    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

    shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
    gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);

    shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
    shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");
    shaderProgram.colorUniform = gl.getUniformLocation(shaderProgram, "uColor");
}

function handleLoadedTexture(texture) {
    //noinspection JSCheckFunctionSignatures
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    gl.bindTexture(gl.TEXTURE_2D, null);
}

var starTexture;

function initTexture()
{
    starTexture = gl.createTexture();
    starTexture.image = new Image();
    starTexture.image.onload = function(){handleLoadedTexture(starTexture)};
    starTexture.image.src = "star.gif";
}

var mvMatrix = mat4.create();
var mvMatrixStack = [];
var pMatrix = mat4.create();

function mvPushMatrix()
{
    var copy = mat4.create();
    mat4.set(mvMatrix, copy);
    mvMatrixStack.push(copy);
}

function mvPopMatrix()
{
    if(mvMatrixStack.length == 0)
    {
        throw "Invalid popMatrix!";
    }
    mvMatrix = mvMatrixStack.pop();
}

function setMatrixUniforms()
{
    gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
    gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}

function degToRad(degrees)
{
    return degrees * Math.PI / 180;
}

function handleClick()
{
    if(explosionImpulse == 0 && explosionForce < 1) {
        explosionImpulse = explosionImpulseMax;
    }
}

function handleWheel(e)
{
    // cross-browser wheel delta
    //var delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));
    var delta = e.wheelDelta || -e.detail;
    z = Math.min(-1, z + delta);
}

var keys = {};

function handleKeyDown(event)
{
    keys[event.keyCode] = true;

    if(String.fromCharCode(event.keyCode) == "F")
    {
        twinkle = !twinkle;
    }
}

function handleKeyUp(event)
{
    keys[event.keyCode] = false;
}

var z = -50;
var xtilt = 90.;
var ytilt = 0.;
var twinkle = true;

function handleKeys()
{
    if(keys[37] || keys[65]) // Left cursor key or A
    {
        // Rotate clockwise around Y axis
        ytilt = (ytilt - 2) % 360;
    }
    if(keys[38] || keys[87]) // Up cursor key or W
    {
        // Rotate counterclockwise around X axis
        xtilt = (xtilt + 2) % 360;
    }
    if(keys[39] || keys[68]) // Right cursor key or D
    {
        // Rotate counterclockwise around Y axis
        ytilt = (ytilt + 2) % 360;
    }
    if(keys[40] || keys[83]) // Down cursor key or S
    {
        // Rotate clockwise around X axis
        xtilt = (xtilt - 2) % 360;
    }
    if(keys[81]) // Q
    {
        // Zoom out
        z -= 1;
    }
    if(keys[69]) // E
    {
        // Zoom in
        z = Math.min(0, z + 1);
    }
    if(keys[90]) // Z
    {
        // Decrement the number of stars drawn.
        numStarsToDraw = Math.max(1, numStarsToDraw - 1);
        writeStarCount();
    }
    if(keys[67]) // C
    {
        // Increment the number of stars drawn.
        numStarsToDraw += 1;
        if(numStarsToDraw > numStars)
        {
            addStars(numStarsToDraw - numStars);
        }
        writeStarCount();
    }
}

var fingerDown = false;
var twoFingersDown = false;
var lastFingerDistance;
var finger0x, finger0y, finger1x, finger1y;
function handleTouchStart(e)
{
    e.preventDefault();
    var touches = e.targetTouches;

    fingerDown = true;
    finger0x = touches[0].pageX;
    finger0y = touches[0].pageY;

    if(touches.length > 1)
    {
        twoFingersDown = true;
        finger1x = touches[1].pageX;
        finger1y = touches[1].pageY;
        lastFingerDistance = Math.abs(finger1x - finger0x) + Math.abs(finger1y - finger0y);
    }
}

var new0x, new0y;
function handleTouchMove(e)
{
    e.preventDefault();
    var touches = e.targetTouches;
    new0x = touches[0].pageX;
    new0y = touches[0].pageY;

    if(!twoFingersDown)
    {
        ytilt = (ytilt + 0.02 * (new0x - finger0x)) % 360;
        xtilt = (xtilt + 0.02 * (new0y - finger0y)) % 360;
    }
    else
    {
        finger0x = new0x;
        finger0y = new0y;
        finger1x = touches[1].pageX;
        finger1y = touches[1].pageY;

        var newFingerDistance = Math.abs(finger1x - finger0x) + Math.abs(finger1y - finger0y);
        var distTol = 3;

        if(lastFingerDistance - newFingerDistance > distTol)
        {
            z *= 1.015;
        }
        else if(newFingerDistance - lastFingerDistance > distTol)
        {
            if(z > -5)
            {
                z = -1.5 + 9 * (z + 1.5) / 10;
            }
            else
            {
                z *= 0.985;
            }
        }
        lastFingerDistance = newFingerDistance;
    }
}

var lastTap = new Date().getTime();
var timeSinceTap;
var doubleTapInterval = 200;
function handleTouchEnd(e)
{
    e.preventDefault();
    var touches = e.targetTouches;

    // All fingers removed
    if(touches.length == 0)
    {
        // Single finger double-tap detection
        if(!twoFingersDown)
        {
            var newTap = new Date().getTime();
            timeSinceTap = newTap - lastTap;

            if(timeSinceTap < doubleTapInterval)
            {
                handleClick();
            }
            lastTap = newTap;
        }

        fingerDown = false;
        twoFingersDown = false;
    }
    else if(touches.length == 1)
    {
        twoFingersDown = false;
    }
}

function button0click()
{
    //numStarsToDraw = Math.max(1, numStarsToDraw - 10);
    //writeStarCount();
}

function button1click()
{
    //numStarsToDraw += 10;
    //if(numStarsToDraw > numStars)
    //{
    //    addStars(numStarsToDraw - numStars);
    //}
    //writeStarCount();
}

var button0pushed = false;
var button1pushed = false;
function handleButton0Push()
{
    button0pushed = true;
}
function handleButton0Release()
{
    button0pushed = false;
}
function handleButton1Push()
{
    button1pushed = true;
}
function handleButton1Release()
{
    button1pushed = false;
}

function handleButtons()
{
    if(button0pushed)
    {
        numStarsToDraw = Math.max(1, numStarsToDraw - 1);
        writeStarCount();
    }
    if(button1pushed)
    {
        numStarsToDraw += 1;
        if(numStarsToDraw > numStars)
        {
            addStars(numStarsToDraw - numStars);
        }
        writeStarCount();
    }
}

var b_starVs; // star vertex buffer
var b_starTCs; // star texture coordinate buffer

function initBuffers()
{
    b_starVs = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b_starVs);
    var vertices = [
        -1., -1., 0.,
        1., -1., 0.,
        -1.,  1., 0.,
        1.,  1., 0.
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    b_starVs.itemSize = 3;
    b_starVs.numItems = 4;

    b_starTCs = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b_starTCs);
    var textureCoords = [
        0., 0.,
        1., 0.,
        0., 1.,
        1., 1.
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords), gl.STATIC_DRAW);
    b_starTCs.itemSize = 2;
    b_starTCs.numItems = 4;
}

function drawStar()
{
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, starTexture);
    gl.uniform1i(shaderProgram.samplerUniform, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, b_starTCs);
    gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, b_starTCs.itemSize, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, b_starVs);
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, b_starVs.itemSize, gl.FLOAT, false, 0, 0);

    setMatrixUniforms();
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, b_starVs.numItems);
}

function Star(startingDistance, rotationSpeed)
{
    this.angle = 0;
    this.dist = startingDistance;
    this.rotationSpeed = rotationSpeed;
    this.phase = Math.random() * 2 * Math.PI;
    this.period = 50 + Math.random() * 250;

    this.randomiseColors();
}

Star.prototype.draw = function(spin, twinkle)
{
    mvPushMatrix();

    // Move to the star's position
    mat4.rotate(mvMatrix, degToRad(this.angle), [0., 1., 0.]);
    mat4.translate(mvMatrix, [this.dist + explosionForce * this.scatterX, explosionForce * this.scatterY, explosionForce * this.scatterZ]);

    // Rotate back so that the star is facing the viewer
    mat4.rotate(mvMatrix, degToRad(-this.angle), [0., 1., 0.]);
    mat4.rotate(mvMatrix, degToRad(-ytilt), [0., 1., 0.]);
    mat4.rotate(mvMatrix, degToRad(-xtilt), [1., 0., 0.]);

    if(twinkle)
    {
        var c = 0.5*(1 + Math.cos(lastTime / this.period + this.phase)); // Twinkle scaling
        gl.uniform3f(shaderProgram.colorUniform, c*this.twinkleR, c*this.twinkleG, c*this.twinkleB);
        drawStar();
    }

    // All stars spin around their Z axis
    mat4.rotate(mvMatrix, degToRad(spin), [0., 0., 1.]);

    // Draw the star in its main color
    gl.uniform3f(shaderProgram.colorUniform, this.r, this.g, this.b);
    drawStar();

    mvPopMatrix();
};

var effectiveFPMS = 60. / 1000.;
Star.prototype.animate = function(elapsedTime)
{
    this.angle += this.rotationSpeed * effectiveFPMS * elapsedTime;

    this.dist -= 0.01 * effectiveFPMS * elapsedTime;
    if(this.dist + explosionForce < 0.)
    {
        this.dist += 5 * (numStars / 100.);
        this.randomiseColors();
    }
};

Star.prototype.randomiseColors = function()
{
    this.r = Math.random();
    this.g = Math.random();
    this.b = Math.random();

    this.twinkleR = Math.random();
    this.twinkleG = Math.random();
    this.twinkleB = Math.random();

    var phi = 2 * Math.PI * Math.random();
    var theta = 2 * Math.PI * Math.random();
    this.scatterX = Math.sin(phi) * Math.cos(theta);
    this.scatterY = Math.sin(phi) * Math.sin(theta);
    this.scatterZ = Math.cos(phi);
};

var stars = [];

function initWorldObjects()
{
    for(var i=0; i<numStars; i++)
    {
        stars.push(new Star((i / 60.), i / numStars));
    }
}

function addStars(numStarsToAdd)
{
    // Add new stars to this thing.
    for(var i = 0; i < numStarsToAdd; i++)
    {
        stars.push(new Star((numStars + i) / 60., (numStars + i) / numStars));
    }
    numStars += numStarsToAdd;
}

var spin=0;
var numStarsToDraw = 0;
function drawScene()
{
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

    mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 10000.0, pMatrix);

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.enable(gl.BLEND);

    mat4.identity(mvMatrix);
    mat4.translate(mvMatrix, [0., 0., z]);
    mat4.rotate(mvMatrix, degToRad(xtilt), [1., 0., 0.]);
    mat4.rotate(mvMatrix, degToRad(ytilt), [0., 1., 0.]);

    for(var i=0; i<numStarsToDraw; i++)
    {
        stars[i].draw(spin, twinkle);
        spin += 0.02;
    }
}

function animate()
{
    if(lastTime != 0)
    {
        for(var i=0; i<numStarsToDraw; i++)
        {
            stars[i].animate(elapsed);
        }

    }
}

function writeFPS()
{
    var counter = document.getElementById("fpscounter");
    counter.innerHTML = fps.toFixed(1) + " fps";
}

function writeStarCount()
{
    var counter = document.getElementById("starcounter");
    var starStr;
    if(numStarsToDraw > 1)
    {
        starStr = " stars"
    }
    else
    {
        starStr = " star";
    }
    counter.innerHTML = numStarsToDraw.toString() + starStr;
}

var explosionForce = 0.;
var explosionImpulse = 0;
const explosionImpulseMax = 90;
var reboundDelay = 0; 
var reboundDelayMax = 90;
function explosionUpdate()
{
    if(explosionImpulse == explosionImpulseMax)
    {
        explosionForce = 0.05;
        explosionImpulse -= 1;
        reboundDelay = reboundDelayMax
    }
    else if(explosionImpulse > 0)
    {
        explosionImpulse -= 1;
        explosionForce *= 1 + 0.7 * (Math.pow(explosionImpulse / explosionImpulseMax, 4.5));
    }
    else if(explosionImpulse == 0 && reboundDelay > 0)
    {
        reboundDelay -= 1;
    }
    else
    {
        explosionForce *= 0.98;
    }
}

var lastTime = new Date().getTime();
var elapsed = 0;
var fps = 0;
var fpsFilter = 30;
function updateFPS()
{
    var timeNow = new Date().getTime();
    elapsed = timeNow - lastTime;
    if(elapsed>0)
    {
        fps += (1000. / elapsed - fps) / fpsFilter;
    }
    lastTime = timeNow;
}

function tick()
{
    updateFPS();
    requestAnimationFrame(tick);
    handleKeys();
    handleButtons();
    drawScene();
    animate();
    explosionUpdate();
}

function touchCheck()
{
    return(('ontouchstart' in window) || (navigator.MaxTouchPoints > 0)
    || (navigator.msMaxTouchPoints > 0));
}

function resizeCanvas()
{
    var canvas = document.getElementById("canvas");
    var w = window;
    var d = document;
    var e = d.documentElement;
    var g = d.getElementsByTagName('body')[0];
    var x = w.innerWidth || e.clientWidth || g.clientWidth;
    var y = w.innerHeight || e.clientHeight || g.clientHeight;
    canvas.height = Math.floor(0.7 * y);
    canvas.width = Math.floor(0.75 * x);
    gl.viewportHeight = canvas.height;
    gl.viewportWidth = canvas.width;
}


var numStars;
var isTouchscreen = false;
function webGLStart()
{
    var canvas = document.getElementById("canvas");

    initGL(canvas);
    initShaders();
    initBuffers();
    initTexture();

    gl.clearColor(0., 0., 0., 1.);

    isTouchscreen = touchCheck();

    if(isTouchscreen) // On a tablet or smartphone, Linux), render fewer stars
    {
        numStars = 100;
        var instructions = document.getElementById("instructions");
        instructions.innerHTML = "<h4>Touch and drag to rotate. Pinch to zoom. Double tap to scatter stars.</h4>";
    }
    else
    {
        numStars = 700;
        var buttons = document.getElementById("buttons");
        buttons.innerHTML = "";
    }
    numStarsToDraw = numStars; // Start by rendering them all. Increment/decrement as needed.
    writeStarCount();
    initWorldObjects();

    document.onkeydown = handleKeyDown;
    document.onkeyup = handleKeyUp;

    canvas.addEventListener('click', handleClick, false);
    canvas.addEventListener('mousewheel', handleWheel, false);
    canvas.addEventListener('DOMMouseScroll', handleWheel, false);

    canvas.addEventListener("touchstart", handleTouchStart, false);
    canvas.addEventListener("touchleave", handleTouchEnd, false);
    canvas.addEventListener("touchend", handleTouchEnd, false);
    canvas.addEventListener("touchmove", handleTouchMove, false);

    var button0 = document.getElementById("button0");
    var button1 = document.getElementById("button1");

    if(isTouchscreen)
    {
        button0.addEventListener("touchstart", handleButton0Push, false);
        button0.addEventListener("touchleave", handleButton0Release, false);
        button0.addEventListener("touchend", handleButton0Release, false);

        button1.addEventListener("touchstart", handleButton1Push, false);
        button1.addEventListener("touchleave", handleButton1Release, false);
        button1.addEventListener("touchend", handleButton1Release, false);
    }

    // Window resize handler
    resizeCanvas(); // Set up initial width
    window.onresize = resizeCanvas;
    setInterval(writeFPS, 500);

    tick();
}