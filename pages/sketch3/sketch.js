// CONTROLS FOR VARIABILITY
// numbers: 1,2,3,4,5,6 to change different colors
// 1 changes the skin color
// 2 changes the eyelid color
// 3 changes the color of the back hair 
// 4 changes the background color
// 5 changes the color of the eyelashes
// 6 changes the color of the highlights
// letters: 'q' 'w' 'e' 'r'
// 'q' & 'w' to control the width of the hair
// 'q' increases the width
// 'w' decreases width as if hair is tied 
// 'e' & 'r' to control the length of the hair
// 'e' increases the length
// 'r' decreases the length
// press the avatar to switch to silly mood!
// have fun messing around with my avatar :)))


// variables
let faceCenterX = 400;
let faceCenterY = 400;
let lashLength;
let lashWidth;
let hairW = 500;
let hairL = 530;

// colors
let hairColor1;
let hairColor2;
let hairColor3;
let highlightColor;
let skinColor;
let neckColor;
let pinkMakeup;
let mascara;
let eyeWhite;
let eyePupil;
let bgColor;

let isSilly = false;

function setup() {
  createCanvas(800, 800);

  hairColor1 = color(219, 193, 132);
  hairColor2 = color(242, 224, 180);
  hairColor3 = color(250, 232, 189);
  highlightColor = color(250, 195, 211);
  skinColor = color(181, 126, 76);
  neckColor = color(153, 110, 73);
  pinkMakeup = color(237, 90, 132);
  mascara = color(35, 66, 189);
  eyeWhite = color(255);
  eyePupil = color(0);
  bgColor = color(135, 212, 217);
}

function draw() {
  background(bgColor);

  // 1 changes the skin color
  if (keyIsPressed && key === '1') {
    skinColor = color(random(120,230), random(80,180), random(50,130));
  }

  // 2 changes the eyelid color
  if (keyIsPressed && key === '2') {
    pinkMakeup = color(random(180,255), random(20,150), random(80,200));
  }

  // 3 changes the color of the back hair 
  if (keyIsPressed && key === '3') {
    hairColor1 = color(random(100,255), random(100,230), random(50,180));
  }

  // 4 changes the background color
  if (keyIsPressed && key === '4') {
    bgColor = color(random(255), random(255), random(255));
  }

  // 5 changes the color of the eyelashes
  if (keyIsPressed && key === '5') {
    mascara = color(random(255), random(255), random(255));
  }

  // 6 changes the color of the highlights
  if (keyIsPressed && key === '6') {
    highlightColor = color(random(255), random(255), random(255));
  }

  // q/w controls hair width (wider/narrower)
  if (keyIsPressed && key === 'q') {
    hairW += 2;
  }
  if (keyIsPressed && key === 'w') {
    hairW -= 2;
  }
  if (hairW > 505){
    hairW = 505; // to make sure hair isnt wider than the top of hair
  }

  // e/r controls hair length (longer/shorter)
  if (keyIsPressed && key === 'e') {
    hairL += 2;
  }
  if (keyIsPressed && key === 'r') {
    hairL -= 2;
  }

  // pupils of eyes will follow mouse
  let px = map(mouseX, 0, width, -15, 15);
  let py = map(mouseY, 0, height, -10, 10);

  backHair();
  neck();
  face();
  hairline();
  bangs();
  eyeShadow();
  leftLashes();
  rightLashes();
  eyes(px, py);
  drawNose();
  lips();
}



// FUNCTIONS TO USE IN DRAW

//to activate silly mood 
function mousePressed() {
  isSilly = !isSilly;
}

function backHair() {
  fill(hairColor1);
  noStroke();
  beginShape();
  curveVertex(400 - hairW/2, 200);
  curveVertex(400 - hairW/2, 200);
  curveVertex(400 - hairW/2 + 50, 200 + hairL/2);
  curveVertex(400 - hairW/3, 200 + hairL);
  curveVertex(400 + hairW/3, 200 + hairL);
  curveVertex(400 + hairW/2 - 50, 200 + hairL/2);
  curveVertex(400 + hairW/2, 200);
  curveVertex(400 + hairW/2, 200);
  endShape();
}

function neck() {
  fill(neckColor);
  noStroke();
  beginShape();
  curveVertex(350, 600);
  curveVertex(350, 600);
  curveVertex(395, 740);
  curveVertex(350, 800);
  curveVertex(450, 800);
  curveVertex(405, 740);
  curveVertex(450, 600);
  curveVertex(450, 600);
  endShape();
}

function face() {
  fill(skinColor);
  noStroke();
  beginShape();
  curveVertex(faceCenterX - 200, faceCenterY - 200);
  curveVertex(faceCenterX - 200, faceCenterY - 200);
  curveVertex(faceCenterX - 170, faceCenterY + 40);
  curveVertex(faceCenterX - 70,  faceCenterY + 200);
  curveVertex(faceCenterX,       faceCenterY + 270);
  curveVertex(faceCenterX + 70,  faceCenterY + 200);
  curveVertex(faceCenterX + 170, faceCenterY + 40);
  curveVertex(faceCenterX + 200, faceCenterY - 200);
  curveVertex(faceCenterX,       faceCenterY - 300);
  curveVertex(faceCenterX - 200, faceCenterY - 200);
  curveVertex(faceCenterX - 200, faceCenterY - 200);
  endShape();
}

function hairline() {
  fill(hairColor2);
  noStroke();
  beginShape();
  curveVertex(400, 220);
  curveVertex(400, 220);
  curveVertex(500, 180);
  curveVertex(600, 240);
  curveVertex(650, 260);
  curveVertex(630, 130);
  curveVertex(500, 50);
  curveVertex(400, 90);
  curveVertex(400, 220);
  curveVertex(400, 220);
  endShape();
}

function bangs() {
  fill(hairColor3);
  noStroke();
  beginShape();
  curveVertex(500, 100);
  curveVertex(500, 100);
  curveVertex(350, 300);
  curveVertex(150, 290);
  curveVertex(160, 150);
  curveVertex(335, 30);
  curveVertex(500, 100);
  curveVertex(120, 270);
  endShape();

  // highlights
  strokeWeight(3);
  stroke(highlightColor);
  noFill();
  for (let i = 0; i < 8; i++) {
    let offsetUp = i * 6;
    let offsetLeft = i * 3;
    beginShape();
    curveVertex(500 - offsetLeft, 100 - offsetUp);
    curveVertex(500 - offsetLeft, 100 - offsetUp);
    curveVertex(340 - offsetLeft, 270 - offsetUp);
    curveVertex(150 - offsetLeft, 290 - offsetUp);
    curveVertex(150 - offsetLeft, 290 - offsetUp);
    endShape();
  }
}

function eyeShadow() {
  fill(pinkMakeup);
  noStroke();
  beginShape();
  curveVertex(380, 370);
  curveVertex(380, 370);
  curveVertex(220, 300);
  curveVertex(120, 370);
  curveVertex(120, 370);
  endShape();

  beginShape();
  curveVertex(420, 370);
  curveVertex(420, 370);
  curveVertex(580, 300);
  curveVertex(680, 370);
  curveVertex(680, 370);
  endShape();
}

function leftLashes() {
  fill(mascara);
  noStroke();
  push();
  for (let i = 0; i < 10; i++) {
    if (i == 0 || i == 9) {
      lashLength = 40;
      lashWidth = 10;
    } else if (i == 1 || i == 8) {
      lashLength = 55;
      lashWidth = 13;
    } else if (i == 2 || i == 7) {
      lashLength = 65;
      lashWidth = 16;
    } else if (i == 3 || i == 6) {
      lashLength = 70;
      lashWidth = 18;
    } else {
      lashLength = 75;
      lashWidth = 20;
    }
    beginShape();
    curveVertex(340, 370);
    curveVertex(340, 370);
    curveVertex(330, 370 - lashLength * 0.5);
    curveVertex(340, 370 - lashLength);
    curveVertex(335, 370 - lashLength * 0.5);
    curveVertex(340 + lashWidth, 370);
    curveVertex(340 + lashWidth, 370);
    endShape();
    translate(-20, 0);
  }
  pop();
}

function rightLashes() {
  fill(mascara);
  noStroke();
  push();
  translate(460, 370);
  for (let i = 0; i < 10; i++) {
    if (i == 0 || i == 9) {
      lashLength = 40;
      lashWidth = 10;
    } else if (i == 1 || i == 8) {
      lashLength = 55;
      lashWidth = 13;
    } else if (i == 2 || i == 7) {
      lashLength = 65;
      lashWidth = 16;
    } else if (i == 3 || i == 6) {
      lashLength = 70;
      lashWidth = 18;
    } else {
      lashLength = 75;
      lashWidth = 20;
    }
    beginShape();
    curveVertex(0, 0);
    curveVertex(0, 0);
    curveVertex(10, -lashLength * 0.5);
    curveVertex(0, -lashLength);
    curveVertex(5, -lashLength * 0.5);
    curveVertex(-lashWidth, 0);
    curveVertex(-lashWidth, 0);
    endShape();
    translate(20, 0);
  }
  pop();
}

function eyes(px, py) {
  fill(eyeWhite);
  noStroke();
  arc(240, 370, 200, 120, 0, PI);
  arc(550, 370, 200, 120, 0, PI);

  fill(eyePupil);
  if (isSilly) {
    arc(260 + px * 0.3, 370, 110, 150, 0, PI);
    arc(530 - px * 0.3, 370, 110, 150, 0, PI);
  } else {
    arc(285 + px, 370 + py, 100, 120, 0, PI);
    arc(595 + px, 370 + py, 100, 120, 0, PI);
  }
}

function drawNose() {
  noFill();
  stroke(0);
  strokeWeight(2);
  beginShape();
  curveVertex(390, 400);
  curveVertex(width/2, height/2);
  curveVertex(410, 465);
  curveVertex(380, 520);
  curveVertex(400, 530);
  curveVertex(380, 530);
  endShape();
}

function lips() {
  let bigLips = false;
  if (mouseX > 370 && mouseX < 430 && mouseY > 575 && mouseY < 635) {
    bigLips = true;
  }

  fill(pinkMakeup);
  noStroke();

  push();
  translate(400, 600);
  if (bigLips) {
    scale(1.4);
  }
  translate(-400, -600);
  beginShape();
  curveVertex(375, 600);
  curveVertex(375, 600);
  curveVertex(390, 580);
  curveVertex(400, 590);
  curveVertex(410, 580);
  curveVertex(425, 600);
  curveVertex(400, 630);
  curveVertex(375, 600);
  curveVertex(375, 600);
  endShape();
  stroke(0, 80);
  strokeWeight(2);
  line(375, 600, 425, 600);
  pop();

  // tongue out!!
  if (isSilly) {
    fill(166, 50, 83);
    noStroke();
    if (bigLips) {
      arc(400, 600, 40, 100, 0, PI);
    } else {
      arc(400, 600, 30, 70, 0, PI);
    }
  }
}