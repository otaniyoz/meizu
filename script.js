'use strict';
window.onload = () => {
  let maze;
  let solution;
  let entranceExit;

  let width;
  let height;
  let cellSize;
  
  let playerX = 1;
  let playerY = 1;
  const showSolution = false;

  let resizeTimer;
  let elapsedTime = 0;
  let startTime = null;
  const targetFrameRate = 60;
  
  const storageName = 'meizuBestScore';
  const timer = document.getElementById('timer');
  const score = document.getElementById('score');
  let bestScore = getBestScoreFromStorage();

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  let musicTime = 0;
  const audioContext = new AudioContext();
  const scriptProcessor = audioContext.createScriptProcessor(2048, 0, 1);
  scriptProcessor.connect(audioContext.destination);
  scriptProcessor.onaudioprocess = playMusic;

  updateValues();
  setupGame();
  drawGame();
  updateTimer();

  function playMusic(e) {
    const tau = 2 * Math.PI;
    const audioData = e.outputBuffer.getChannelData(0);
    const timeStep = 1 / audioContext.sampleRate;
    const oscNoise = () => Math.random() * 2 - 1;
    const oscSawtooth = (freq) => (freq * 2 + 1) % 2 - 1;
    const oscSquare = (freq) => 1 - (freq * 2 & 1) * 2;
    const notesMelody = '11333313333333333333311133366666677777533666';

    for (let i = 0; i < audioData.length; i++) {
      musicTime += timeStep;
      const beat = musicTime * 1.5
      const bar = beat * 0.25;
      const pattern = bar * 0.1667;
      const note = beat * 2;
      const barModulo = bar % 1;
      const beatModulo = beat % 1;
      const noteModulo = note % 1;
      const patternModulo = pattern % 1;
      
      let signal = 0;

      if (pattern <= 1) signal += Math.pow(patternModulo, 2) * Math.sin(tau * 220 * beat) * 0.5;
      else if (pattern > 1) signal += oscNoise() * Math.pow(1 - beatModulo, 8) * 0.01;
      
      if (pattern > 1 && pattern <= 2) {
        signal += Math.sin(tau * 440 * bar) * Math.pow(1 - barModulo, 5) * 0.1;
      }
      else if (pattern > 2) {
        const melody = notesMelody.charAt(note % notesMelody.length) * 16 * note;
        signal += Math.pow(1 - noteModulo, 5) * Math.sin(tau * melody) * 0.1;
        if (note % 5 <= 0.5 || note % 3 <= 0.4) signal += (Math.sin(tau * melody) + Math.sin(tau * melody * 0.8)) * Math.pow(1 - noteModulo, 8) * 0.01;
        if (bar % 3 <= 0.65) signal += Math.sin(tau * 440 * bar) * Math.pow(1 - barModulo, 2) * 0.01;
      }
      
      audioData[i] = signal * Math.min(1, pattern);
    }
  }

  function setupGame() {
    elapsedTime = 0;
    startTime = performance.now();
    
    maze = generateMaze();
    entranceExit = generateEntranceExit();

    playerX = entranceExit.start[0];
    playerY = entranceExit.start[1];
  }

  function generateMaze() {
    const startX = 1;
    const startY = 1;

    const stack = [[startX, startY]];
    const newMaze = Array.from({ length: height }, () => Array(width).fill(1));
    newMaze[startY][startX] = 0;

    while (stack.length > 0) {
      const [x, y] = stack[stack.length - 1];
      const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]]; // right, left, down, up
      directions.sort(() => Math.random() - 0.5);

      let foundNewPath = false;
      for (const [dx, dy] of directions) {
        const newX = x + dx * 2;
        const newY = y + dy * 2;
        if (newX >= 1 && newX < width - 1 && newY >= 1 && newY < height - 1 && newMaze[newY][newX] === 1 && (x !== newX || y !== newY)) {
          newMaze[y + dy][x + dx] = 0;
          newMaze[newY][newX] = 0;
          stack.push([newX, newY]);
          foundNewPath = true;
          break;
        }
      }
      if (!foundNewPath) stack.pop();
    }

    return newMaze;
  }

  function generateEntranceExit() {
    const outerWalls = [];
    for (let y = 0; y < height; y++) {
      const lastRow = y === height - 1;
      for (let x = 0; x < width; x++) {
        const lastCol = x === width - 1;
        if ((!x || lastCol || !y || lastRow) && maze[y][x]) {
          if (!(x || y) || (lastCol && lastRow) || (!x && lastRow) || (lastCol && !y)) continue;
          if ((!y && maze[y + 1][x]) || (lastRow && maze[y - 1][x]) || (!x && maze[y][x + 1]) || (lastCol && maze[y][x - 1])) continue;
          outerWalls.push([x, y]);
        }
      }
    }

    const startEnd = { start: [1, 1], end: [width - 1, height - 1] };
    if (entranceExit) startEnd.start = entranceExit.end;
    else startEnd.start = outerWalls[Math.random() * outerWalls.length | 0];
    maze[startEnd.start[1]][startEnd.start[0]] = 0;

    const availableExits = outerWalls.filter(([x, y]) => !(x === startEnd.start[0] && y === startEnd.start[1]));
    startEnd.end = availableExits[Math.random() * availableExits.length | 0];
  
    maze[startEnd.end[1]][startEnd.end[0]] = 0;
    solution = solveMaze(startEnd);

    let attempts = 0;
    const maxAttempts = availableExits.length;
    while (!solution && solution.length > 4 && attempts < maxAttempts) {
      maze[startEnd.end[1]][startEnd.end[0]] = 1;
      startEnd.end = availableExits[attempts];
      maze[startEnd.end[1]][startEnd.end[0]] = 0;
      solution = solveMaze(startEnd);
      attempts++;
    }

    return startEnd;
  }

  function solveMaze(startEnd) {
    const visited = new Set();
    const { start, end } = startEnd;
    const queue = [[start[0], start[1], [start]]];
    const rowsNumber = maze.length;
    const colsNumber = maze[0].length;

    while (queue.length > 0) {
      const [x, y, path] = queue.shift();
      if (x === end[0] && y === end[1]) return path;

      const key = `${x},${y}`;
      if (visited.has(key)) continue;
      visited.add(key);

      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const newX = x + dx;
        const newY = y + dy;

        if (newX >= 0 && newY < rowsNumber && newY >= 0 && newX < colsNumber && maze[newY][newX] === 0) {
          queue.push([newX, newY, [...path, [newX, newY]]]);
        }
      }
    }

    return null;
  }

  function drawGame() {
    for (let y = 0; y < maze.length; y++) {
      for (let x = 0; x < maze[y].length; x++) {
        ctx.fillStyle = maze[y][x] === 1 ? '#000' : '#fff';
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }

    if (showSolution) {
      if (solution) {
        ctx.fillStyle = '#00ff00';
        solution.forEach(([x, y]) => {
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        });
      }
      ctx.fillStyle = '#0000ff';
      ctx.fillRect(entranceExit.end[0] * cellSize, entranceExit.end[1] * cellSize, cellSize, cellSize);
      ctx.fillStyle = '#ff00ff';
      ctx.fillRect(entranceExit.start[0] * cellSize, entranceExit.start[1] * cellSize, cellSize, cellSize);
    }
 
    ctx.fillStyle = '#ff2526';
    ctx.fillRect(playerX * cellSize, playerY * cellSize, cellSize, cellSize);
  }

  function movePlayer(dX, dY) {
    const newX = playerX + dX;
    const newY = playerY + dY;
    const rowsNumber = maze.length;
    const colsNumber = maze[0].length;

    if (newX >= 0 && newX < colsNumber && newY >= 0 && newY < rowsNumber && maze[newY][newX] === 0) {
      playerX = newX;
      playerY = newY;
      if (playerX === entranceExit.end[0] && playerY === entranceExit.end[1]) {
        const seconds = parseInt(timer.textContent) || 1;
        const pathLength = solution.length || 1;
        const currentScore = pathLength / seconds;
        if (currentScore > bestScore) {
          bestScore = currentScore | 0;
          score.textContent = `${bestScore}`;
          writeBestScoreToStorage();
        }
        setupGame();
        drawGame();
      }
    }
  }

  function getBestScoreFromStorage() {
    try {
      const storedData = localStorage.getItem(storageName);
      const scoreValue = storedData ? parseInt(storedData) : 0;
      score.textContent = scoreValue;
      return scoreValue;
    } 
    catch (error) {
      console.error('Error retrieving history from local storage:', error);
      return 0;
    }
  }

  function writeBestScoreToStorage() {
    try {
      localStorage.setItem(storageName, bestScore);
    } 
    catch (error) {
      if (error.name === 'QuotaExceededError') console.error('Local storage quota exceeded.');
      else console.error('Error saving data to local storage:', error);
    }
  }
  
  function getElementDimensions(element, subtractPadding=true) {
    const rect = element.getBoundingClientRect();
    const widthWithPaddings = rect.width | 0;
    const heightWithPaddings = rect.height | 0;
    const elementComputedStyle = window.getComputedStyle(element, null);
    const paddingLeftRight = parseFloat(elementComputedStyle.paddingLeft) + parseFloat(elementComputedStyle.paddingRight);
    const paddingTopBottom = parseFloat(elementComputedStyle.paddingTop) + parseFloat(elementComputedStyle.paddingBottom);

    return {width: widthWithPaddings - subtractPadding * paddingLeftRight, height: heightWithPaddings - subtractPadding * paddingTopBottom};
  }

  function updateTimer() {
    const currentTime = performance.now();
    if (startTime === null) startTime = currentTime;
    else elapsedTime = currentTime - startTime;

    const elapsedSeconds = elapsedTime / 1000 | 0;
    timer.textContent = `${elapsedSeconds}`;

    const now = performance.now();
    const targetDelay = 1000 / targetFrameRate;
    const timeToNextFrame = targetDelay - (now - currentTime);
    requestAnimationFrame(updateTimer);
  }

  function findSquareSize(W, H, A_min, A_max) {
  for (let A = A_min; A <= A_max; A++) {
    let rows = H / A | 0;
    let cols = W / A | 0;
    if (rows % 2 !== 0 && cols % 2 !== 0) {
      return A;
    }
  }
  return null;
}

  function updateValues() {
    const percent = 2;
    const h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    const w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);

    const main = document.getElementById('main');
    const header = document.getElementById('header');
    const canvasContainerDimensions = getElementDimensions(main);
    cellSize = findSquareSize(canvasContainerDimensions.width | 0, canvasContainerDimensions.height | 0, 16, 40) || Math.max((percent * h) / 100, (percent * w) / 100) | 0;

    const moduloWidth = canvasContainerDimensions.width % cellSize;
    const moduloHeight = canvasContainerDimensions.height % cellSize;
    if (moduloWidth !== 0) canvasContainerDimensions.width -= moduloWidth;
    if (moduloHeight !== 0) canvasContainerDimensions.height -= moduloHeight;

    const headerDimensions = getElementDimensions(header, false);
    const availableHeight = window.innerHeight - headerDimensions.height;
    const availableWidth = window.innerWidth - headerDimensions.width;
    
    height = availableHeight / cellSize | 0;
    width = canvasContainerDimensions.width / cellSize | 0;
    canvas.width = cellSize * width;
    canvas.height = cellSize * height;

    header.style.width = `${main.offsetWidth - 2 * cellSize}px`;
  }

  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      entranceExit = null;
      updateValues(); 
      setupGame(); 
      drawGame();
    }, 150);
  });

  document.addEventListener('fullscreenchange', () => {
    entranceExit = null;
    updateValues(); 
    setupGame(); 
    drawGame();
  });

  document.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'w'].includes(event.key)) movePlayer(0, -1);
    else if (['ArrowDown', 's'].includes(event.key)) movePlayer(0, 1);
    else if (['ArrowLeft', 'a'].includes(event.key)) movePlayer(-1, 0);
    else if (['ArrowRight', 'd'].includes(event.key)) movePlayer(1, 0);
    
    if (audioContext.state === 'suspended') audioContext.resume();
    drawGame();
  });

  function setupOrientationSensor() {
    const options = { frequency: 60, referenceFrame: 'device' };
    const sensor = new AbsoluteOrientationSensor(options);

    sensor.addEventListener('reading', () => {
      const { pitch, roll } = sensor.euler;
      mapOrientationToPlayerMove(roll, pitch); 
    });

    sensor.addEventListener('error', (event) => {
      // if (event.error.name === 'NotReadableError') console.error('Orientation sensor is not available. Falling back to deviceorientation event.');
      // else if (event.error.name === 'NotAllowedError') console.error('Permission to use orientation sensor was denied. Falling back to deviceorientation event.');
      if (event.error.name === 'NotReadableError') alert('Orientation sensor is not available. Falling back to deviceorientation event.');
      else if (event.error.name === 'NotAllowedError') alert('Permission to use orientation sensor was denied. Falling back to deviceorientation event.');
      setupDeviceOrientationFallback();
    });

    sensor.start();
  }

  function setupDeviceOrientationFallback() {
    window.addEventListener('deviceorientation', (event) => {
      const { beta, gamma } = event;
      mapOrientationToPlayerMove(gamma, beta); 
    });
  }

  function mapOrientationToPlayerMove(tiltX, tiltY) {
    let playerMoveX = 0;
    let playerMoveY = 0;

    if (tiltX < -10) playerMoveX = -1;
    else if (tiltX > 10) playerMoveX = 1;

    if (tiltY < -10) playerMoveY = 1;
    else if (tiltY > 10) playerMoveY = -1;

    movePlayer(playerMoveX, playerMoveY);
    drawGame();
  }

  if (navigator.permissions) {
    Promise.all([navigator.permissions.query({ name: 'accelerometer' }), navigator.permissions.query({ name: 'magnetometer' })]).then(results => {
      if (results.every(result => result.state === 'granted')) setupOrientationSensor();
      // else console.log('Not allowed to access sensors. Falling back to deviceorientation event.');
      else alert('Not allowed to access sensors. Falling back to deviceorientation event.');
    }).catch(err => {
      // console.log('Cannot ask for permission to use sensors. Falling back to deviceorientation event.');
      alert('Cannot ask for permission to use sensors. Falling back to deviceorientation event.');
      setupDeviceOrientationFallback();
    });
  } else {
    // console.log('Cannot ask for permission. Falling back to deviceorientation event.');
    alert('Cannot ask for permission. Falling back to deviceorientation event.');
    setupDeviceOrientationFallback();
  }
};