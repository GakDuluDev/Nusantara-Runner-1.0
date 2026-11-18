import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { soundEngine } from '../audio/soundEngine';
import type {
  GameLevel,
  GamePhase,
  GateQuizState,
  PopupQuizState,
  QuestionItem,
  RunStats,
} from '../types/game';
import {
  createBusOrTruckObstacle,
  createCarOrAngkotObstacle,
  createOverheadPortalObstacle,
  createPlayerModel,
  createQuizGates,
  createRoadsideSegment,
  createRoadTextures,
  createScooterObstacle,
  type GateInstance,
  type ObstacleInstance,
  type PlayerRig,
} from './proceduralModels';
import { QuizManager } from './quizManager';

const LANE_XS: [number, number, number] = [-3.2, 0, 3.2];
const SEGMENT_LENGTH = 26;
const SEGMENT_COUNT = 8;

// Pre-allocated math helpers outside render loop (Zero GC)
const _vec3 = new THREE.Vector3();

export interface RunnerCallbacks {
  onStatsChange: (stats: RunStats) => void;
  onGateQuizChange: (gateQuiz: GateQuizState | null) => void;
  onTriggerPopupQuiz: (popup: PopupQuizState) => void;
  onFeedbackBanner: (banner: {
    text: string;
    tone: 'success' | 'danger' | 'info';
  } | null) => void;
  onGameOver: (finalStats: RunStats) => void;
  onRequestPauseToggle: () => void;
}

export interface RunnerBridge {
  startNewRun: () => void;
  resolvePopupQuiz: (isCorrect: boolean, mode: 'passage' | 'revive') => void;
  steerLane: (delta: -1 | 1) => void;
  jump: () => void;
  slide: () => void;
}

interface RunnerCanvasProps {
  phase: GamePhase;
  callbacks: RunnerCallbacks;
  bridgeRef: React.MutableRefObject<RunnerBridge | null>;
}

export const RunnerCanvas: React.FC<RunnerCanvasProps> = ({
  phase,
  callbacks,
  bridgeRef,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const phaseRef = useRef<GamePhase>(phase);
  const callbacksRef = useRef<RunnerCallbacks>(callbacks);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Detect software WebGL cleanly from GPU renderer string
    const isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    );
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const skyColor = new THREE.Color(0xbae6fd);
    scene.background = skyColor;
    scene.fog = new THREE.Fog(0xdbeafe, 45, 135);

    const camera = new THREE.PerspectiveCamera(
      62,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      200,
    );
    camera.position.set(0, 4.6, 8.2);
    camera.lookAt(0, 1.4, -10);

    // Mandatory studio environment reflection
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();

    // Warm/cool Indonesian daylight rig (<= 3 shadow casters)
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x92400e, 0.85);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.65);
    sunLight.position.set(14, 24, 12);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 90;
    sunLight.shadow.camera.left = -22;
    sunLight.shadow.camera.right = 22;
    sunLight.shadow.camera.top = 28;
    sunLight.shadow.camera.bottom = -18;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.55);
    rimLight.position.set(-10, 10, -18);
    scene.add(rimLight);

    const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const textures = createRoadTextures(maxAnisotropy);

    // Ground & Road Geometry (extended beyond perimeter)
    const groundPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(180, 260),
      new THREE.MeshStandardMaterial({
        color: 0x4d7c0f,
        roughness: 0.95,
        metalness: 0.0,
      }),
    );
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.set(0, -0.04, -75);
    groundPlane.receiveShadow = true;
    scene.add(groundPlane);

    const roadMat = new THREE.MeshStandardMaterial({
      map: textures.asphaltTex,
      roughness: 0.82,
      metalness: 0.06,
    });
    const roadMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(10.8, 260),
      roadMat,
    );
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.position.set(0, 0, -75);
    roadMesh.receiveShadow = true;
    scene.add(roadMesh);

    const sidewalkMat = new THREE.MeshStandardMaterial({
      map: textures.sidewalkTex,
      roughness: 0.85,
      metalness: 0.02,
    });
    [-8.4, 8.4].forEach((sx) => {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.2, 260), sidewalkMat);
      sw.position.set(sx, 0.08, -75);
      sw.receiveShadow = true;
      scene.add(sw);
    });

    const curbMat = new THREE.MeshStandardMaterial({
      map: textures.curbTex,
      roughness: 0.72,
      metalness: 0.05,
    });
    [-5.55, 5.55].forEach((cx) => {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 260), curbMat);
      curb.position.set(cx, 0.11, -75);
      curb.receiveShadow = true;
      scene.add(curb);
    });

    // Roadside repeating segments
    const roadsideSegments: THREE.Group[] = [];
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const z = 14 - i * SEGMENT_LENGTH;
      const seg = createRoadsideSegment(z, textures.highwaySignTex, i % 4 === 2);
      scene.add(seg);
      roadsideSegments.push(seg);
    }

    // Player Rig
    const player: PlayerRig = createPlayerModel(textures.contactShadowTex);
    scene.add(player.root);

    // Pre-warm shaders on hardware WebGL
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Mutable Game Engine State
    const quizManager = new QuizManager();
    let obstacles: ObstacleInstance[] = [];
    let activeGate: GateInstance | null = null;

    let targetLane: 0 | 1 | 2 = 1;
    let playerX = 0;
    let playerY = 0;
    let playerVy = 0;
    let isJumping = false;
    let slideTimer = 0;
    let runCycle = 0;

    let score = 0;
    let distance = 0;
    let lives = 3;
    let level: GameLevel = 1;
    let multiplier = 1;
    let correctAnswers = 0;
    let totalQuestions = 0;
    let shieldRemaining = 0;
    let invulnTimer = 0;
    let slowdownTimer = 0;
    let shakeTimer = 0;
    let reviveUsed = false;

    let nextObstacleZ = -42;
    let nextQuizDistance = 120;
    let checkpointCounter = 0;
    let bannerTimer = 0;
    let lastHudSync = 0;

    const showBanner = (
      text: string,
      tone: 'success' | 'danger' | 'info',
      duration = 2.4,
    ) => {
      bannerTimer = duration;
      callbacksRef.current.onFeedbackBanner({ text, tone });
    };

    const emitStats = (force = false) => {
      const now = performance.now();
      if (!force && now - lastHudSync < 85) return;
      lastHudSync = now;
      callbacksRef.current.onStatsChange({
        score: Math.floor(score),
        distance: Math.floor(distance),
        lives,
        level,
        multiplier,
        correctAnswers,
        totalQuestions,
        shieldRemaining: Math.max(0, Number(shieldRemaining.toFixed(1))),
        reviveUsed,
      });
    };

    const clearDynamicWorld = () => {
      obstacles.forEach((o) => scene.remove(o.group));
      obstacles = [];
      if (activeGate) {
        scene.remove(activeGate.group);
        activeGate.disposables.forEach((d) => d.dispose());
        activeGate = null;
      }
      callbacksRef.current.onGateQuizChange(null);
    };

    const resetRun = () => {
      clearDynamicWorld();
      quizManager.reset();

      targetLane = 1;
      playerX = 0;
      playerY = 0;
      playerVy = 0;
      isJumping = false;
      slideTimer = 0;
      runCycle = 0;

      score = 0;
      distance = 0;
      lives = 3;
      level = 1;
      multiplier = 1;
      correctAnswers = 0;
      totalQuestions = 0;
      shieldRemaining = 0;
      invulnTimer = 0;
      slowdownTimer = 0;
      shakeTimer = 0;
      reviveUsed = false;

      nextObstacleZ = -42;
      nextQuizDistance = 120;
      checkpointCounter = 0;
      bannerTimer = 0;
      player.root.visible = true;
      player.shieldMesh.visible = false;
      callbacksRef.current.onFeedbackBanner(null);
      emitStats(true);
    };

    const spawnObstaclePattern = (currentLevel: GameLevel) => {
      // Avoid spawning right on top of an active gate
      if (activeGate && Math.abs(-110 - activeGate.z) < 22) {
        return;
      }

      const pickLane = (): number => Math.floor(Math.random() * 3);
      const laneA = pickLane();

      const createByRoll = (lane: number, forceJumpableOrSlide = false): ObstacleInstance => {
        const r = Math.random();
        let obs: ObstacleInstance;
        if (forceJumpableOrSlide) {
          if (r < 0.35) obs = createScooterObstacle(lane);
          else if (r < 0.7) obs = createCarOrAngkotObstacle('angkot', lane);
          else obs = createOverheadPortalObstacle(lane, textures.portalTex);
        } else if (currentLevel === 1) {
          if (r < 0.35) obs = createScooterObstacle(lane);
          else if (r < 0.65) obs = createCarOrAngkotObstacle('angkot', lane);
          else if (r < 0.85) obs = createOverheadPortalObstacle(lane, textures.portalTex);
          else obs = createBusOrTruckObstacle('bus', lane);
        } else if (currentLevel === 2) {
          if (r < 0.25) obs = createScooterObstacle(lane);
          else if (r < 0.5) obs = createCarOrAngkotObstacle(Math.random() < 0.5 ? 'angkot' : 'mobil', lane);
          else if (r < 0.72) obs = createOverheadPortalObstacle(lane, textures.portalTex);
          else obs = createBusOrTruckObstacle(Math.random() < 0.6 ? 'bus' : 'truk', lane);
        } else {
          if (r < 0.2) obs = createScooterObstacle(lane);
          else if (r < 0.44) obs = createCarOrAngkotObstacle(Math.random() < 0.5 ? 'angkot' : 'mobil', lane);
          else if (r < 0.68) obs = createOverheadPortalObstacle(lane, textures.portalTex);
          else obs = createBusOrTruckObstacle(Math.random() < 0.55 ? 'bus' : 'truk', lane);
        }

        // Level 2 & 3 moving traffic approaching player
        if (currentLevel >= 2 && obs.kind !== 'portal') {
          if (currentLevel === 2 && Math.random() < 0.65) {
            obs.speedOffset = obs.kind === 'motor' ? 9 : 6.5;
          } else if (currentLevel === 3) {
            obs.speedOffset = obs.kind === 'motor' ? 12.5 : 9;
          }
        }
        return obs;
      };

      const spawnAt = (obs: ObstacleInstance, zOffset: number) => {
        obs.group.position.set(LANE_XS[obs.lane], 0, zOffset);
        scene.add(obs.group);
        obstacles.push(obs);
      };

      const first = createByRoll(laneA);
      spawnAt(first, -112);

      // Level 2+: occasionally block a second lane so player must read traffic
      if (currentLevel >= 2 && Math.random() < (currentLevel === 3 ? 0.65 : 0.4)) {
        const laneB = (laneA + (Math.random() < 0.5 ? 1 : 2)) % 3;
        const second = createByRoll(laneB, true);
        spawnAt(second, -112);
      }

      // Level 3: tight sequential combo (jump/dodge then quick slide or lane shift!)
      if (currentLevel === 3 && Math.random() < 0.45) {
        const comboLane = Math.random() < 0.5 ? laneA : (laneA + 1) % 3;
        const followUp =
          first.kind === 'portal'
            ? createCarOrAngkotObstacle('angkot', comboLane)
            : createOverheadPortalObstacle(comboLane, textures.portalTex);
        spawnAt(followUp, -128);
      }
    };

    const triggerQuizEncounter = () => {
      if (activeGate) return;
      checkpointCounter += 1;
      const diff = quizManager.getDifficultyForLevel(level);
      // Every 3rd checkpoint prefers a passage question (if available) to showcase 5-option modal,
      // while most checkpoints trigger fast 3-Lane Gate Runner questions!
      const wantPassage = checkpointCounter % 3 === 0;
      const question: QuestionItem = quizManager.pickQuestion(
        diff,
        !wantPassage,
      );

      if (question.passage && question.passage.trim().length > 0) {
        totalQuestions += 1;
        emitStats(true);
        callbacksRef.current.onTriggerPopupQuiz({
          mode: 'passage',
          question,
          timeLimitSeconds: null,
        });
        return;
      }

      // 3-Lane Gate Runner mode (1 correct + 2 random distractors from 5 options)
      const laneOptions = quizManager.buildThreeLaneOptions(question);
      const gateZ = -105;

      // Clear nearby obstacles so the gate lanes are clearly visible
      obstacles = obstacles.filter((o) => {
        if (Math.abs(o.group.position.z - gateZ) < 18) {
          scene.remove(o.group);
          return false;
        }
        return true;
      });

      activeGate = createQuizGates(gateZ, LANE_XS, laneOptions, maxAnisotropy);
      scene.add(activeGate.group);

      callbacksRef.current.onGateQuizChange({
        question,
        laneOptions,
      });
    };

    const steerLane = (delta: -1 | 1) => {
      if (phaseRef.current !== 'playing') return;
      soundEngine.unlock();
      const next = Math.max(0, Math.min(2, targetLane + delta)) as 0 | 1 | 2;
      if (next !== targetLane) {
        targetLane = next;
        soundEngine.playLaneSwitch();
      }
    };

    const jump = () => {
      if (phaseRef.current !== 'playing') return;
      soundEngine.unlock();
      if (!isJumping) {
        isJumping = true;
        playerVy = 13.6;
        slideTimer = 0;
        soundEngine.playJump();
      }
    };

    const slide = () => {
      if (phaseRef.current !== 'playing') return;
      soundEngine.unlock();
      if (isJumping) {
        playerVy = Math.min(playerVy, -19);
      }
      slideTimer = 0.72;
      soundEngine.playSlide();
    };

    const resolvePopupQuiz = (
      isCorrect: boolean,
      mode: 'passage' | 'revive',
    ) => {
      if (mode === 'revive') {
        if (isCorrect) {
          reviveUsed = true;
          lives = 1;
          shieldRemaining = 5.0;
          invulnTimer = 3.0;
          correctAnswers += 1;
          totalQuestions += 1;
          score += 200 * multiplier;
          soundEngine.playCorrect();
          // Clear obstacles directly near player
          obstacles = obstacles.filter((o) => {
            if (o.group.position.z > -22 && o.group.position.z < 10) {
              scene.remove(o.group);
              return false;
            }
            return true;
          });
          showBanner('REVIVE BERHASIL! +1 Nyawa & Perisai 5s', 'success', 2.8);
          emitStats(true);
        } else {
          soundEngine.playWrong();
          emitStats(true);
          callbacksRef.current.onGameOver({
            score: Math.floor(score),
            distance: Math.floor(distance),
            lives: 0,
            level,
            multiplier,
            correctAnswers,
            totalQuestions: totalQuestions + 1,
            shieldRemaining: 0,
            reviveUsed: true,
          });
        }
        return;
      }

      // Reading passage checkpoint
      if (isCorrect) {
        correctAnswers += 1;
        score += 350 * multiplier;
        shieldRemaining = 8.0;
        soundEngine.playCorrect();
        showBanner(
          `BENAR! +${350 * multiplier} Skor & Perisai 8s`,
          'success',
          2.6,
        );
      } else {
        lives = Math.max(0, lives - 1);
        slowdownTimer = 1.6;
        soundEngine.playWrong();
        showBanner('KURANG TEPAT! -1 Nyawa', 'danger', 2.4);
        if (lives <= 0) {
          if (!reviveUsed) {
            reviveUsed = true;
            const revQ = quizManager.pickReviveQuestion(level);
            callbacksRef.current.onTriggerPopupQuiz({
              mode: 'revive',
              question: revQ,
              timeLimitSeconds: 10,
            });
            emitStats(true);
            return;
          } else {
            emitStats(true);
            callbacksRef.current.onGameOver({
              score: Math.floor(score),
              distance: Math.floor(distance),
              lives: 0,
              level,
              multiplier,
              correctAnswers,
              totalQuestions,
              shieldRemaining: 0,
              reviveUsed,
            });
            return;
          }
        }
      }
      emitStats(true);
    };

    bridgeRef.current = {
      startNewRun: resetRun,
      resolvePopupQuiz,
      steerLane,
      jump,
      slide,
    };

    // Keyboard Controls
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (phaseRef.current === 'playing' || phaseRef.current === 'paused') {
          callbacksRef.current.onRequestPauseToggle();
          return;
        }
      }
      if (phaseRef.current !== 'playing') return;

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        steerLane(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        steerLane(1);
      } else if (
        e.key === 'ArrowUp' ||
        e.key === ' ' ||
        e.key === 'w' ||
        e.key === 'W'
      ) {
        e.preventDefault();
        jump();
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        slide();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    // Touch Swipe Controls (Mobile)
    let touchStartX = 0;
    let touchStartY = 0;
    let touchActive = false;

    const onTouchStart = (e: TouchEvent) => {
      if (phaseRef.current !== 'playing') return;
      if (e.touches.length === 0) return;
      soundEngine.unlock();
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchActive = true;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!touchActive || phaseRef.current !== 'playing') return;
      touchActive = false;
      if (e.changedTouches.length === 0) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      const threshold = 28;
      if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;

      if (Math.abs(dx) > Math.abs(dy)) {
        steerLane(dx < 0 ? -1 : 1);
      } else {
        if (dy < 0) jump();
        else slide();
      }
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('touchstart', onTouchStart, { passive: true });
    domEl.addEventListener('touchend', onTouchEnd, { passive: true });

    // Resize listener
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // WebGL context loss/restore
    let contextLost = false;
    const onContextLost = (ev: Event) => {
      ev.preventDefault();
      contextLost = true;
    };
    const onContextRestored = () => {
      contextLost = false;
    };
    domEl.addEventListener('webglcontextlost', onContextLost);
    domEl.addEventListener('webglcontextrestored', onContextRestored);

    // Animation Loop with Software-WebGL afterDraw pacing
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed) return;
      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const currentPhase = phaseRef.current;

      if (currentPhase === 'lobby') {
        // Gentle idle showcase animation in lobby
        runCycle += dt * 4;
        textures.asphaltTex.offset.y -= dt * 0.45;
        textures.sidewalkTex.offset.y -= dt * 0.45;
        textures.curbTex.offset.y -= dt * 0.45;
        roadsideSegments.forEach((seg) => {
          seg.position.z += dt * 8;
          if (seg.position.z > 26) {
            seg.position.z -= SEGMENT_COUNT * SEGMENT_LENGTH;
          }
        });
        player.leftLeg.rotation.x = Math.sin(runCycle) * 0.45;
        player.rightLeg.rotation.x = -Math.sin(runCycle) * 0.45;
        player.leftArm.rotation.x = -Math.sin(runCycle) * 0.4;
        player.rightArm.rotation.x = Math.sin(runCycle) * 0.4;

        camera.position.x = THREE.MathUtils.damp(camera.position.x, Math.sin(runCycle * 0.2) * 1.1, 3, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, 4.2, 4, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, 7.8, 4, dt);
        _vec3.set(0, 1.4, -10);
        camera.lookAt(_vec3);
      } else if (currentPhase === 'playing') {
        // Progressive Speed & Level Scaling
        let baseSpeed = 19;
        if (distance >= 1500) {
          if (level !== 3) {
            level = 3;
            multiplier = 2;
            soundEngine.playLevelUp();
            showBanner('LEVEL 3: MACET PANTURA! Skor 2x Aktif!', 'info', 3.0);
          }
          baseSpeed = Math.min(40, 31 + (distance - 1500) * 0.005);
        } else if (distance >= 500) {
          if (level !== 2) {
            level = 2;
            multiplier = 1;
            soundEngine.playLevelUp();
            showBanner('LEVEL 2: JAM SIBUK! Kendaraan Mulai Melaju!', 'info', 3.0);
          }
          baseSpeed = 23.5 + ((distance - 500) / 1000) * 6.5;
        } else {
          level = 1;
          multiplier = 1;
          baseSpeed = 18.5 + (distance / 500) * 3.5;
        }

        if (slowdownTimer > 0) {
          slowdownTimer -= dt;
          baseSpeed *= 0.65;
        }

        if (bannerTimer > 0) {
          bannerTimer -= dt;
          if (bannerTimer <= 0) {
            callbacksRef.current.onFeedbackBanner(null);
          }
        }

        // Advance distance & passive score
        const distStep = baseSpeed * dt * 0.65;
        distance += distStep;
        score += distStep * 2.2 * multiplier;

        // Scroll road textures & roadside props
        const texScroll = (baseSpeed * dt) / 14.5;
        textures.asphaltTex.offset.y -= texScroll;
        textures.sidewalkTex.offset.y -= texScroll * 1.4;
        textures.curbTex.offset.y -= texScroll * 1.3;

        roadsideSegments.forEach((seg) => {
          seg.position.z += baseSpeed * dt;
          if (seg.position.z > 28) {
            seg.position.z -= SEGMENT_COUNT * SEGMENT_LENGTH;
          }
        });

        // Smooth lane movement (exponential damping)
        const targetX = LANE_XS[targetLane];
        playerX = THREE.MathUtils.damp(playerX, targetX, 16, dt);
        player.root.position.x = playerX;

        // Jump physics
        if (isJumping) {
          playerY += playerVy * dt;
          playerVy -= 34 * dt;
          if (playerY <= 0) {
            playerY = 0;
            playerVy = 0;
            isJumping = false;
          }
        }

        // Slide posture
        let isSliding = false;
        if (slideTimer > 0) {
          slideTimer -= dt;
          isSliding = true;
        }

        player.bodyGroup.position.y = playerY;
        if (isSliding && !isJumping) {
          player.bodyGroup.rotation.x = THREE.MathUtils.damp(
            player.bodyGroup.rotation.x,
            -Math.PI * 0.38,
            18,
            dt,
          );
          player.bodyGroup.position.y = THREE.MathUtils.damp(
            player.bodyGroup.position.y,
            -0.38,
            18,
            dt,
          );
        } else {
          player.bodyGroup.rotation.x = THREE.MathUtils.damp(
            player.bodyGroup.rotation.x,
            0,
            14,
            dt,
          );
        }

        // Contact shadow scales with height
        const shadowScale = Math.max(0.45, 1 - playerY * 0.22);
        player.contactShadow.scale.set(shadowScale, shadowScale, 1);

        // Running leg/arm cycle
        runCycle += dt * baseSpeed * 0.68;
        if (isJumping) {
          player.leftLeg.rotation.x = 0.55;
          player.rightLeg.rotation.x = -0.45;
          player.leftArm.rotation.x = -0.9;
          player.rightArm.rotation.x = -0.9;
        } else {
          player.leftLeg.rotation.x = Math.sin(runCycle) * 0.78;
          player.rightLeg.rotation.x = -Math.sin(runCycle) * 0.78;
          player.leftArm.rotation.x = -Math.sin(runCycle) * 0.68;
          player.rightArm.rotation.x = Math.sin(runCycle) * 0.68;
        }

        // Shield & Invulnerability visuals
        if (shieldRemaining > 0) {
          shieldRemaining = Math.max(0, shieldRemaining - dt);
          player.shieldMesh.visible = true;
          player.shieldMesh.rotation.y += dt * 2.2;
          player.shieldMesh.position.y = 1.08 + playerY * 0.9;
        } else {
          player.shieldMesh.visible = false;
        }

        if (invulnTimer > 0) {
          invulnTimer -= dt;
          player.root.visible = Math.floor(invulnTimer * 14) % 2 === 0;
        } else {
          player.root.visible = true;
        }

        // Trigger Quiz Checkpoints
        if (distance >= nextQuizDistance) {
          nextQuizDistance += level === 3 ? 135 : 120;
          triggerQuizEncounter();
        }

        // Spawn Obstacles
        nextObstacleZ += baseSpeed * dt;
        const spawnSpacing =
          level === 1 ? 29 : level === 2 ? 23 : 18.5;
        if (nextObstacleZ >= 0) {
          spawnObstaclePattern(level);
          nextObstacleZ = -spawnSpacing;
        }

        // Update Quiz Gates
        if (activeGate) {
          activeGate.group.position.z += baseSpeed * dt;
          activeGate.z = activeGate.group.position.z;

          if (!activeGate.resolved && activeGate.z >= -0.4) {
            activeGate.resolved = true;
            // Determine closest lane
            let chosenLane = targetLane;
            let bestDist = Infinity;
            for (let l = 0; l < 3; l++) {
              const d = Math.abs(playerX - LANE_XS[l]);
              if (d < bestDist) {
                bestDist = d;
                chosenLane = l as 0 | 1 | 2;
              }
            }
            const isCorrect = activeGate.laneCorrectMap[chosenLane];
            totalQuestions += 1;

            if (isCorrect) {
              correctAnswers += 1;
              const bonus = 250 * multiplier;
              score += bonus;
              shieldRemaining = 8.0;
              soundEngine.playCorrect();
              showBanner(
                `JAWABAN BENAR! +${bonus} Skor & Perisai 8s`,
                'success',
                2.5,
              );
            } else {
              lives = Math.max(0, lives - 1);
              slowdownTimer = 1.4;
              soundEngine.playWrong();
              showBanner('JAWABAN SALAH! -1 Nyawa', 'danger', 2.4);
            }

            callbacksRef.current.onGateQuizChange(null);

            if (lives <= 0) {
              scene.remove(activeGate.group);
              activeGate.disposables.forEach((d) => d.dispose());
              activeGate = null;

              if (!reviveUsed) {
                reviveUsed = true;
                const revQ = quizManager.pickReviveQuestion(level);
                callbacksRef.current.onTriggerPopupQuiz({
                  mode: 'revive',
                  question: revQ,
                  timeLimitSeconds: 10,
                });
              } else {
                callbacksRef.current.onGameOver({
                  score: Math.floor(score),
                  distance: Math.floor(distance),
                  lives: 0,
                  level,
                  multiplier,
                  correctAnswers,
                  totalQuestions,
                  shieldRemaining: 0,
                  reviveUsed,
                });
              }
              emitStats(true);
            }
          }

          if (activeGate && activeGate.z > 12) {
            scene.remove(activeGate.group);
            activeGate.disposables.forEach((d) => d.dispose());
            activeGate = null;
          }
        }

        // Update Obstacles & Check Collisions (only if still alive)
        let triggeredGameStop = lives <= 0;
        const playerBottom = playerY;
        const playerTop = isSliding && !isJumping ? 0.92 : playerY + 1.85;
        const playerHalfW = 0.36;
        const playerHalfD = 0.35;

        const remainingObstacles: ObstacleInstance[] = [];

        for (let i = 0; i < obstacles.length; i++) {
          const obs = obstacles[i];
          const moveSpeed = baseSpeed + obs.speedOffset;
          obs.group.position.z += moveSpeed * dt;

          // Spin vehicle wheels
          if (obs.wheels.length > 0 && obs.speedOffset > 0) {
            for (let w = 0; w < obs.wheels.length; w++) {
              obs.wheels[w].rotation.x += dt * 12;
            }
          }

          // Klakson approaching traffic
          if (!obs.honked && obs.group.position.z > -28 && obs.group.position.z < -20) {
            obs.honked = true;
            if (obs.speedOffset > 0) {
              const hornType =
                obs.kind === 'motor'
                  ? 'motor'
                  : obs.kind === 'bus' || obs.kind === 'truk'
                    ? 'bus'
                    : 'angkot';
              soundEngine.playHorn(hornType);
            }
          }

          // AABB Collision Check
          const oz = obs.group.position.z;
          const ox = obs.group.position.x;

          if (
            !triggeredGameStop &&
            invulnTimer <= 0 &&
            Math.abs(oz) < obs.halfDepth + playerHalfD &&
            Math.abs(playerX - ox) < obs.halfWidth + playerHalfW
          ) {
            const hitsVertical =
              playerTop > obs.bottomClearance && playerBottom < obs.height;

            if (hitsVertical) {
              if (shieldRemaining > 0) {
                shieldRemaining = 0;
                invulnTimer = 1.6;
                soundEngine.playShieldBreak();
                showBanner('PERISAI MELINDUNGI ANDA!', 'info', 2.0);
              } else {
                lives = Math.max(0, lives - 1);
                invulnTimer = 2.0;
                shakeTimer = 0.32;
                soundEngine.playCrash();

                if (lives <= 0) {
                  triggeredGameStop = true;
                  if (!reviveUsed) {
                    reviveUsed = true;
                    const revQ = quizManager.pickReviveQuestion(level);
                    callbacksRef.current.onTriggerPopupQuiz({
                      mode: 'revive',
                      question: revQ,
                      timeLimitSeconds: 10,
                    });
                  } else {
                    callbacksRef.current.onGameOver({
                      score: Math.floor(score),
                      distance: Math.floor(distance),
                      lives: 0,
                      level,
                      multiplier,
                      correctAnswers,
                      totalQuestions,
                      shieldRemaining: 0,
                      reviveUsed,
                    });
                  }
                } else {
                  showBanner(
                    `TERTABRAK! Sisa ${lives} Nyawa`,
                    'danger',
                    2.0,
                  );
                }
              }
              // Remove collided obstacle
              scene.remove(obs.group);
              continue;
            }
          }

          if (obs.group.position.z < 16) {
            remainingObstacles.push(obs);
          } else {
            scene.remove(obs.group);
          }
        }
        obstacles = remainingObstacles;

        // Smooth Chase Camera + Speed FOV
        const targetFov = level === 1 ? 62 : level === 2 ? 66 : 71;
        if (Math.abs(camera.fov - targetFov) > 0.05) {
          camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 4, dt);
          camera.updateProjectionMatrix();
        }

        let shakeX = 0;
        let shakeY = 0;
        if (shakeTimer > 0) {
          shakeTimer -= dt;
          shakeX = (Math.random() - 0.5) * 0.45;
          shakeY = (Math.random() - 0.5) * 0.35;
        }

        camera.position.x =
          THREE.MathUtils.damp(camera.position.x, playerX * 0.55, 7, dt) +
          shakeX;
        camera.position.y =
          THREE.MathUtils.damp(camera.position.y, 4.45 + playerY * 0.45, 7, dt) +
          shakeY;
        camera.position.z = THREE.MathUtils.damp(camera.position.z, 8.2, 6, dt);
        _vec3.set(playerX * 0.35, 1.45 + playerY * 0.35, -12);
        camera.lookAt(_vec3);

        emitStats(false);
      }

      if (!contextLost) {
        renderer.render(scene, camera);
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', handleResize);
      domEl.removeEventListener('touchstart', onTouchStart);
      domEl.removeEventListener('touchend', onTouchEnd);
      domEl.removeEventListener('webglcontextlost', onContextLost);
      domEl.removeEventListener('webglcontextrestored', onContextRestored);

      clearDynamicWorld();
      envRT.dispose();
      Object.values(textures).forEach((t) => t.dispose());
      renderer.dispose();
      if (domEl.parentNode === container) {
        container.removeChild(domEl);
      }
    };
  }, [bridgeRef]);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 w-full h-full overflow-hidden bg-sky-200"
    />
  );
};
