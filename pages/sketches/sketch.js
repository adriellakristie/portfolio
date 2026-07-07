//PARANOID


//INSTRUCTIONS:
//This is mostly a performance piece and scenes will advance with time
//There is a small interactive aspect in the second scene where you can move your mouse around the screen!

//STORYLINE:
//SCENE 0: NORMAL
//SCENE 1: ONDEL ONDEL LOOK AT EACH OTHER
//SCENE 2: FLICKER
//SCENE 3: DARK SCREEN
//SCENE 4: EYES TURN RED
//SCENE 5: RED EYES AND LOOKING FORWARD
//SCENE 6: RGB COLOR RANDOMIZER
//SCENE 7: ONDEL ONDEL SHOWS UP (SCARIER VER)
//SCENE 8: FLICKER 2
//SCENE 9: BACK TO NORMAL 

//CONTEXT:
//Ondel Ondel is an Indonesian puppet figure, often seen in traditional performances
//I wanted to incorporate a lil bit of my cultural background in this project
//hope u enjoy :))

//to create variables for character 1 and character 2
let char1, char2;

//setting up variables for the scenes
let scene = 0;
let sceneStartTime = 0;

//these are the durations of each scene
let sceneDurations = [3000, 3700, 3000, 2000, 1500, 1500, 800, 500, 4000, 3000, Infinity];

//flicker variables
let flickerOn = true;
let lastFlicker = 0;
let flickerInterval = 300;


function setup() {
  createCanvas(windowWidth, windowHeight);

  let cx = width / 2;
  let cy = height/ 2;

  //creating the ondel ondel objects using the ondel ondel class
  //these are the 2 characters featured in the project 
  char1 = new Ondelondel(cx-255, cy, {
    skin: '#FFF7DC',
    bodyColor: '#3CAEA3',
    lipColor: '#DB5B4D',
    crownColor: '#DB5B4D',
    gemColor: '#FCD556'
  });

  char2 = new Ondelondel(cx+255, cy, {
    skin: '#DBD7C5',
    bodyColor: '#FCD556',
    lipColor: '#DB5B4D',
    crownColor: '#C93C8A',
    gemColor: '#75B3F0'
  });

  //eye shift attribute to control how much the iris of the eye shifts/moves 
  char1.eyeShift = 0;
  char2.eyeShift = 0;

  //shaking attributes, some scenes will have the ondel ondels shaking
  char1.shakeX = 0; 
  char1.shakeY = 0;
  char2.shakeX = 0; 
  char2.shakeY = 0;

  sceneStartTime = millis();
}

function draw() {
  let now = millis();
  let elapsed = now - sceneStartTime;

  //There are 8 scenes 
  if (scene < 9 && elapsed > sceneDurations[scene]) {
    //to make sure the scene continues to advance
    scene++;


    sceneStartTime = now;
    elapsed = 0;


    //SCENE 1: ONDEL ONDEL LOOK AT EACH OTHER
    if (scene == 1) {
      char1.eyeShift = 18;
      char2.eyeShift = -18;
    }

  }
  //SCENE 2 AND SCENE 8: share flicker logic 
  if (scene == 2 || scene == 8) {

    let t = elapsed/ sceneDurations[2];
    //speeding up the flicker
    flickerInterval = lerp(300, 60, t); 
    

    if (now - lastFlicker > flickerInterval) {
      flickerOn = !flickerOn;
      lastFlicker = now;
    }

    char1.shakeX = random(-t * 6, t * 6);
    char1.shakeY = random(-t * 4, t * 4);
    char2.shakeX = random(-t * 6, t * 6);
    char2.shakeY = random(-t * 4, t * 4);

  } else {
    char1.shakeX = 0;
    char1.shakeY = 0;
    char2.shakeX = 0;
    char2.shakeY = 0;
  }

  //SCENE 3: DARK SCREEN (Black plain background)
  if (scene == 3) {
    background(0);
  }

  //SCENE 4: EYES TURN RED
  else if (scene == 4) {
    background(0);
    drawRedEyes(char1, true);
    drawRedEyes(char2, true);

  //SCENE 5: RED EYES AND LOOKING FORWARD
  } else if (scene == 5) {
    background(0);
    drawRedEyes(char1, false);
    drawRedEyes(char2, false);

  //SCENE 6: RGB COLOR RANDOMIZER
  } else if (scene == 6) {
    char1.eyeShift = 0;
    char2.eyeShift = 0;
    background(random(255), random(255), random(255));
    char1.skin = color(random(255), random(255), random(255));
    char1.bodyColor = color(random(255), random(255), random(255));
    char1.lipColor = color(random(255), random(255), random(255));
    char1.crownColor = color(random(255), random(255), random(255));
    char1.gemColor = color(random(255), random(255), random(255));
    char2.skin = color(random(255), random(255), random(255));
    char2.bodyColor = color(random(255), random(255), random(255));
    char2.lipColor =color(random(255), random(255), random(255));
    char2.crownColor = color(random(255), random(255), random(255));
    char2.gemColor = color(random(255), random(255), random(255));
    
    push(); 
    char1.draw(); 
    pop();


    push(); 
    char2.draw(); 
    pop();

    drawRedEyes(char1, false);
    drawRedEyes(char2, false);

  //SCENE 7: ONDEL ONDEL SHOWS UP (SCARIER VER)
  //colors are recustomized here to a red color palette 
  } else if (scene === 7) {
    background(0);
    char1.skin = '#db3218';
    char1.bodyColor = '#dc1e1e';
    char1.lipColor = '#dc1e1e';
    char1.crownColor = '#961b08';
    char1.gemColor = '#383d30';
    char2.skin = '#e0511b';
    char2.bodyColor = '#c24516';
    char2.lipColor = '#c24516';
    char2.crownColor = '#a82d00';
    char2.gemColor = '#383d30';

    push();
    char1.draw();
    pop();

    push();
    char2.draw();
    pop();

    drawRedEyes(char1, false);
    drawRedEyes(char2, false);

  //SCENE 9: BACK TO NORMAL  
  }else if(scene == 9){
    
  background('#20639B');

    char1.skin = '#FFF7DC';
    char1.bodyColor = '#3CAEA3';
    char1.lipColor = '#DB5B4D';
    char1.crownColor = '#DB5B4D';
    char1.gemColor = '#FCD556';
    char2.skin = '#DBD7C5';
    char2.bodyColor = '#FCD556';
    char2.lipColor = '#DB5B4D';
    char2.crownColor = '#C93C8A';
    char2.gemColor = '#75B3F0';

    push();
    char1.draw();
    pop();

    push();
    char2.draw();
    pop();

  //WHEN ITS IN SCENE 2 AND FLICKER IS NOT ON
  } else if (scene == 2 && !flickerOn) {
    background(5, 5, 10);

  //WHEN ITS IN SCENE 8 AND FLICKER IS NOT ON
  } else if (scene == 8 && !flickerOn) {
    background(0);
    push();
    char1.draw();
    pop();

    push();
    char2.draw();
    pop();

    //eyes are already red in this scene so push pop is here in this else if block
    //so that the red eyes can be on top of the characters
    drawRedEyes(char1, false);
    drawRedEyes(char2, false);

  //plain blue background
  } else {
    background('#20639B');
    if (scene == 1) {
    let t = elapsed / sceneDurations[1];
    drawBackgroundEyes(t, mouseX, mouseY);
    }
  }

  //to draw characters in scenes 0,1,2 on top of effects
  if (scene < 3) {
    push(); 
    char1.draw(); 
    pop();

    push(); 
    char2.draw(); 
    pop();
  }

  //to make the lights flickering effect in scenes 2 and 8 
  if ((scene == 2 || scene == 8) && !flickerOn) {
    noStroke();
    fill(0, 190);
    rect(0, 0, width, height);
  }
} //end of draw function

//to draw red eyes for scenes 4-8
function drawRedEyes(c, useShift) {
  let fx = c.x;
  let fy = c.y;
  let ex = 0;
  if (useShift) {
    ex = c.eyeShift;
  }

  fill(220, 30, 30); noStroke();
  beginShape();
  curveVertex(fx-145, fy-45); 
  curveVertex(fx-145, fy-45);
  curveVertex(fx-125, fy-65); 
  curveVertex(fx-105, fy-68);
  curveVertex(fx-85,  fy-65); 
  curveVertex(fx-65,  fy-45);
  curveVertex(fx-85,  fy-27); 
  curveVertex(fx-105, fy-25);
  curveVertex(fx-125, fy-27); 
  curveVertex(fx-145, fy-45);
  curveVertex(fx-145, fy-45);
  endShape(CLOSE);

  beginShape();
  curveVertex(fx+65,  fy-45); 
  curveVertex(fx+65,  fy-45);
  curveVertex(fx+85,  fy-65); 
  curveVertex(fx+105, fy-68);
  curveVertex(fx+125, fy-65); 
  curveVertex(fx+145, fy-45);
  curveVertex(fx+125, fy-27); 
  curveVertex(fx+105, fy-25);
  curveVertex(fx+85,  fy-27); 
  curveVertex(fx+65,  fy-45);
  curveVertex(fx+65,  fy-45);
  endShape(CLOSE);

  fill(0); noStroke();
  ellipse(fx-100+ex, fy-48, 38, 38);
  ellipse(fx+110+ex, fy-48, 38, 38);

  noFill(); stroke(15,10,5,200); strokeWeight(3.5);
  ellipse(fx-100+ex, fy-48, 38, 38);
  ellipse(fx+110+ex, fy-48, 38, 38);

  noStroke(); fill(20);
  ellipse(fx-100+ex, fy-48, 18, 18);
  ellipse(fx+110+ex, fy-48, 18, 18);

  fill(255);
  ellipse(fx-97+ex,  fy-52, 7, 7);
  ellipse(fx+113+ex, fy-52, 7, 7);
}

//to draw eyes in the background 
//INTERACTIVE EYES
function drawBackgroundEyes(t, mx, my) {
  for (let i = 0; i < 10; i++) {
    let ex = random(width);
    let ey = random(height);
    
    //distance between mouse and eye
    let d = dist(mx, my, ex, ey); 
    //controls opacity so closer to mouse = more visible and further = invisible
    let opac = map(d, 0, 300, 200, 0);
    //prevents opacity to hit a negative number
    opac = constrain(opac, 0, 200);

    fill(220, 30, 30, opac); noStroke();
    ellipse(ex - 35, ey, 70, 35);
    ellipse(ex + 35, ey, 70, 35);
    fill(0, opac);
    ellipse(ex - 35, ey, 24, 24);
    ellipse(ex + 35, ey, 24, 24);
    fill(255, opac);
    ellipse(ex - 30, ey - 6, 8, 8);
    ellipse(ex + 40, ey - 6, 8, 8);
  }
}
//to resize window
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}