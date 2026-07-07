class Ondelondel {
  //to create an ondel ondel object
  //users can input their variability when creating however, there is also a default option
  constructor(x, y, colors = {}) {
    this.x = x || 500;
    this.y = y || 500;
    this.skin = colors.skin       || '#FFF7DC';
    this.bodyColor = colors.bodyColor  || '#3CAEA3';
    this.lipColor = colors.lipColor   || '#DB5B4D';
    this.crownColor = colors.crownColor || '#DB5B4D';
    this.gemColor = colors.gemColor   || '#FCD556';
    this.eyeShift = 0;
    this.shakeX = 0;
    this.shakeY = 0;
  }

  draw() {

    //to reference the center of the ondel ondel's face
    //some scenes have shaking motion, so with the shake, the center of the face adjusts too
    let faceCenterX = this.x + this.shakeX;
    let faceCenterY = this.y + this.shakeY;

    //building the body/clothes 
    fill(this.bodyColor);
    noStroke();
    rect(faceCenterX - 250, height - 200, 500, height - 200);
    arc(faceCenterX, height - 200, 500, 220, PI, TWO_PI);

    //detailing on clothes
    fill(0, 40);
    triangle(faceCenterX-180, height, faceCenterX-170, height, faceCenterX-180, height-100);
    triangle(faceCenterX+180, height, faceCenterX+170, height, faceCenterX+180, height-100);

    fill('#98bf6b');
    rect(faceCenterX - 65, height - 300, 180, 300);
    rect(faceCenterX - 115, height - 300, 180, 300);
    fill(250);
    rect(faceCenterX - 70, height - 300, 140, 300);
    fill(200);
    quad(faceCenterX-70, height-300, faceCenterX-70, height-220, faceCenterX+70, height-130, faceCenterX+70, height-300);

    //buttons on clothes
    fill('#B03123');
    circle(faceCenterX-68, height-128, 25); 
    circle(faceCenterX-68, height-78, 25); 
    circle(faceCenterX-68, height-28, 25);
    circle(faceCenterX+72, height-128, 25); 
    circle(faceCenterX+72, height-78, 25); 
    circle(faceCenterX+72, height-28, 25);
    fill(this.lipColor); 
    stroke('#B03123'); 
    strokeWeight(1);
    circle(faceCenterX-70, height-130, 25); 
    circle(faceCenterX-70, height-80, 25); 
    circle(faceCenterX-70, height-30, 25);
    circle(faceCenterX+70, height-130, 25); 
    circle(faceCenterX+70, height-80, 25); 
    circle(faceCenterX+70, height-30, 25);

    stroke(100, 100); strokeWeight(2);
    line(faceCenterX, height-300, faceCenterX, height);

    // --- EARS ---
fill(this.skin); noStroke();
ellipse(faceCenterX-180, faceCenterY, 60, 80);
ellipse(faceCenterX+180, faceCenterY, 60, 80);
fill(230, 190, 140, 120);
ellipse(faceCenterX-180, faceCenterY+5, 32, 45);
fill(200, 150, 110, 80);
ellipse(faceCenterX-180, faceCenterY+10, 16, 25);
fill(230, 190, 140, 120);
ellipse(faceCenterX+180, faceCenterY+5, 32, 45);
fill(200, 150, 110, 80);
ellipse(faceCenterX+180, faceCenterY+10, 16, 25);

// --- FACE ---
fill(this.skin); noStroke();
beginShape();
curveVertex(faceCenterX-200, faceCenterY-175);
curveVertex(faceCenterX-200, faceCenterY-195);
curveVertex(faceCenterX-170, faceCenterY+15);
curveVertex(faceCenterX-70,  faceCenterY+155);
curveVertex(faceCenterX,     faceCenterY+180);
curveVertex(faceCenterX+70,  faceCenterY+155);
curveVertex(faceCenterX+170, faceCenterY+15);
curveVertex(faceCenterX+200, faceCenterY-175);
curveVertex(faceCenterX+200, faceCenterY-175);
endShape();

fill(0);
arc(faceCenterX, faceCenterY-165, 400, 190, PI, TWO_PI);
triangle(faceCenterX-200, faceCenterY-175, faceCenterX-197, faceCenterY-135, faceCenterX-160, faceCenterY-165);
triangle(faceCenterX+200, faceCenterY-175, faceCenterX+197, faceCenterY-135, faceCenterX+160, faceCenterY-165);

// --- CROWN ---
noStroke();
fill(this.crownColor);
beginShape();
curveVertex(faceCenterX-200, faceCenterY-145);
curveVertex(faceCenterX-200, faceCenterY-145);
curveVertex(faceCenterX-150, faceCenterY-155);
curveVertex(faceCenterX-70,  faceCenterY-145);
curveVertex(faceCenterX,     faceCenterY-95);
curveVertex(faceCenterX+70,  faceCenterY-145);
curveVertex(faceCenterX+150, faceCenterY-155);
curveVertex(faceCenterX+200, faceCenterY-145);
curveVertex(faceCenterX+150, faceCenterY-175);
curveVertex(faceCenterX,     faceCenterY-195);
curveVertex(faceCenterX-150, faceCenterY-175);
curveVertex(faceCenterX-200, faceCenterY-145);
curveVertex(faceCenterX-200, faceCenterY-145);
endShape(CLOSE);
arc(faceCenterX, faceCenterY-175, 400, 220, PI, TWO_PI);
fill(this.gemColor);
circle(faceCenterX, faceCenterY-145, 40);


// --- CROWN ORNAMENTS ---
let numSticks = 30;
let arcCenterX = faceCenterX;
let arcCenterY = faceCenterY - 175;
let arcRadiusX = 200;
let arcRadiusY = 110;

for (let i = 0; i < numSticks; i++) {
  let angle = map(i, 0, numSticks-1, PI, TWO_PI);
  let t = map(i, 0, numSticks-1, -1, 1);
  let stickLength = map(1 - t*t, 0, 1, 30, 160);

  let x1 = arcCenterX + cos(angle) * arcRadiusX;
  let y1 = arcCenterY + sin(angle) * arcRadiusY;

  let x2 = x1 + cos(angle) * stickLength;
  let y2 = y1 + sin(angle) * stickLength;

  strokeWeight(3); stroke('#FFD700');
  line(x1, y1, x2, y2);

  for (let j = 1; j <= 6; j++) {
    let pp = j / 7.0;
    let cx = lerp(x1, x2, pp);
    let cy = lerp(y1, y2, pp);

    noStroke();
    if (j%3===0) fill('#FF4444');
    else if (j%3===1) fill('#FF7FC4');
    else fill(this.bodyColor);

    ellipse(cx, cy, 6, 6);
  }

  noStroke();
  if (i%3===0) fill('#FF4444');
  else if (i%3===1) fill('#FF7FC4');
  else fill(this.bodyColor);

  ellipse(x2, y2, 10, 10);
}

// --- EYEBROWS ---
stroke(60,30,20); 
strokeWeight(4); 
noFill();
beginShape();
curveVertex(faceCenterX-150, faceCenterY-75);
curveVertex(faceCenterX-150, faceCenterY-75);
curveVertex(faceCenterX-120, faceCenterY-90);
curveVertex(faceCenterX-100, faceCenterY-93);
curveVertex(faceCenterX-80,  faceCenterY-90);
curveVertex(faceCenterX-60,  faceCenterY-75);
curveVertex(faceCenterX-60,  faceCenterY-75);
endShape();

beginShape();
curveVertex(faceCenterX+60,  faceCenterY-75);
curveVertex(faceCenterX+60,  faceCenterY-75);
curveVertex(faceCenterX+80,  faceCenterY-90);
curveVertex(faceCenterX+105, faceCenterY-93);
curveVertex(faceCenterX+125, faceCenterY-90);
curveVertex(faceCenterX+150, faceCenterY-75);
curveVertex(faceCenterX+150, faceCenterY-75);
endShape();

// --- EYE WHITES ---
fill(255); 
noStroke();
beginShape();
curveVertex(faceCenterX-145, faceCenterY-45);
curveVertex(faceCenterX-145, faceCenterY-45);
curveVertex(faceCenterX-125, faceCenterY-65);
curveVertex(faceCenterX-105, faceCenterY-68);
curveVertex(faceCenterX-85,  faceCenterY-65);
curveVertex(faceCenterX-65,  faceCenterY-45);
curveVertex(faceCenterX-85,  faceCenterY-27);
curveVertex(faceCenterX-105, faceCenterY-25);
curveVertex(faceCenterX-125, faceCenterY-27);
curveVertex(faceCenterX-145, faceCenterY-45);
curveVertex(faceCenterX-145, faceCenterY-45);
endShape();

beginShape();
curveVertex(faceCenterX+65,  faceCenterY-45);
curveVertex(faceCenterX+65,  faceCenterY-45);
curveVertex(faceCenterX+85,  faceCenterY-65);
curveVertex(faceCenterX+105, faceCenterY-68);
curveVertex(faceCenterX+125, faceCenterY-65);
curveVertex(faceCenterX+145, faceCenterY-45);
curveVertex(faceCenterX+125, faceCenterY-27);
curveVertex(faceCenterX+105, faceCenterY-25);
curveVertex(faceCenterX+85,  faceCenterY-27);
curveVertex(faceCenterX+65,  faceCenterY-45);
curveVertex(faceCenterX+65,  faceCenterY-45);
endShape();

// --- IRISES ---
let ex = this.eyeShift;
fill(80,60,40);
ellipse(faceCenterX-100+ex, faceCenterY-48, 38, 38);
ellipse(faceCenterX+110+ex, faceCenterY-48, 38, 38);

noFill(); stroke(15,10,5,200); strokeWeight(3.5);
ellipse(faceCenterX-100+ex, faceCenterY-48, 38, 38);
ellipse(faceCenterX+110+ex, faceCenterY-48, 38, 38);

noStroke(); fill(20);
ellipse(faceCenterX-100+ex, faceCenterY-48, 18, 18);
ellipse(faceCenterX+110+ex, faceCenterY-48, 18, 18);

fill(255);
ellipse(faceCenterX-97+ex,  faceCenterY-52, 7, 7);
ellipse(faceCenterX+113+ex, faceCenterY-52, 7, 7);

// --- NOSE ---
stroke(200,150,100); strokeWeight(2.5); noFill();
beginShape();
curveVertex(faceCenterX,    faceCenterY);
curveVertex(faceCenterX,    faceCenterY);
curveVertex(faceCenterX-8,  faceCenterY+40);
curveVertex(faceCenterX-12, faceCenterY+53);
curveVertex(faceCenterX,    faceCenterY+57);
curveVertex(faceCenterX+12, faceCenterY+53);
curveVertex(faceCenterX+12, faceCenterY+53);
endShape();

noStroke(); fill(180,120,80,60);
ellipse(faceCenterX-14, faceCenterY+55, 16, 10);
ellipse(faceCenterX+14, faceCenterY+55, 16, 10);

// --- LIPS ---
noStroke(); fill(this.lipColor);

beginShape();
curveVertex(faceCenterX-55, faceCenterY+125);
curveVertex(faceCenterX-55, faceCenterY+125);
curveVertex(faceCenterX-25, faceCenterY+113);
curveVertex(faceCenterX,    faceCenterY+120);
curveVertex(faceCenterX+25, faceCenterY+113);
curveVertex(faceCenterX+55, faceCenterY+125);
curveVertex(faceCenterX+25, faceCenterY+135);
curveVertex(faceCenterX,    faceCenterY+133);
curveVertex(faceCenterX-25, faceCenterY+135);
curveVertex(faceCenterX-55, faceCenterY+125);
curveVertex(faceCenterX-55, faceCenterY+125);
endShape();

beginShape();
curveVertex(faceCenterX-55, faceCenterY+128);
curveVertex(faceCenterX-55, faceCenterY+128);
curveVertex(faceCenterX-25, faceCenterY+153);
curveVertex(faceCenterX,    faceCenterY+163);
curveVertex(faceCenterX+25, faceCenterY+153);
curveVertex(faceCenterX+55, faceCenterY+128);
curveVertex(faceCenterX,    faceCenterY+133);
curveVertex(faceCenterX-55, faceCenterY+128);
curveVertex(faceCenterX-55, faceCenterY+128);
endShape();

  }
}
