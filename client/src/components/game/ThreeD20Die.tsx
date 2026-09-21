import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export interface ThreeD20DieProps {
  isRolling: boolean;
  targetNumber?: number | null;
  targetDC?: number;
  size?: number;
  className?: string;
  onSettle?: () => void;
}

export const ThreeD20Die: React.FC<ThreeD20DieProps> = ({
  isRolling,
  targetNumber,
  targetDC,
  size = 240,
  className = '',
  onSettle,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const isRollingRef = useRef(isRolling);
  const targetNumberRef = useRef(targetNumber);
  const targetDCRef = useRef(targetDC);
  const onSettleRef = useRef(onSettle);

  const angularVelRef = useRef(new THREE.Vector3(0.2, 0.24, 0.16));
  const hasSettledRef = useRef(false);
  const settleBounceRef = useRef(1.0);

  // Keep refs in sync with props
  useEffect(() => {
    isRollingRef.current = isRolling;
    if (isRolling) {
      hasSettledRef.current = false;
      settleBounceRef.current = 1.25;
      angularVelRef.current.set(
        (Math.random() > 0.5 ? 1 : -1) * (0.2 + Math.random() * 0.12),
        (Math.random() > 0.5 ? 1 : -1) * (0.22 + Math.random() * 0.12),
        (Math.random() > 0.5 ? 1 : -1) * (0.18 + Math.random() * 0.1)
      );
    }
  }, [isRolling]);

  useEffect(() => {
    targetNumberRef.current = targetNumber;
  }, [targetNumber]);

  useEffect(() => {
    targetDCRef.current = targetDC;
  }, [targetDC]);

  useEffect(() => {
    onSettleRef.current = onSettle;
  }, [onSettle]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(0, 0, 4.3);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 2. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff1d0, 2.8);
    keyLight.position.set(3, 5, 4);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 1.4);
    fillLight.position.set(-4, -2, 2.5);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0xf59e0b, 2.5, 10);
    rimLight.position.set(0, 0, 3.2);
    scene.add(rimLight);

    // 3. Icosahedron D20 Geometry (20 non-indexed faces)
    const baseGeo = new THREE.IcosahedronGeometry(1.2, 0).toNonIndexed();
    baseGeo.computeVertexNormals();

    const diceGroup = new THREE.Group();
    scene.add(diceGroup);

    // Deep obsidian body material
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x181326,
      roughness: 0.16,
      metalness: 0.88,
      flatShading: true,
    });
    const bodyMesh = new THREE.Mesh(baseGeo, bodyMaterial);
    diceGroup.add(bodyMesh);

    // Glowing amber wireframe edges
    const edgesGeo = new THREE.EdgesGeometry(baseGeo);
    const edgesMat = new THREE.LineBasicMaterial({
      color: 0xf59e0b,
      linewidth: 2,
    });
    const wireframe = new THREE.LineSegments(edgesGeo, edgesMat);
    diceGroup.add(wireframe);

    // 4. Calculate Face Centers, Normals, and Exact Orientation Quaternions
    const pos = baseGeo.attributes.position;
    const faceCenters: THREE.Vector3[] = [];
    const faceNormals: THREE.Vector3[] = [];
    const faceTargetQuats: THREE.Quaternion[] = [];
    const numberPlanes: THREE.Mesh[] = [];
    const texturesToDispose: THREE.Texture[] = [];
    const materialsToDispose: THREE.Material[] = [];

    function createNumberTexture(num: number): THREE.CanvasTexture {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, 256, 256);

      ctx.font = '900 130px "Cinzel", "Times New Roman", Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (num === 20) {
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 26;
        ctx.fillStyle = '#fef08a';
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 6;
      } else if (num === 1) {
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 26;
        ctx.fillStyle = '#fca5a5';
        ctx.strokeStyle = '#7f1d1d';
        ctx.lineWidth = 6;
      } else {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#fde68a';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 5;
      }

      const text = num === 6 || num === 9 ? `${num}.` : `${num}`;
      ctx.strokeText(text, 128, 128);
      ctx.fillText(text, 128, 128);

      const texture = new THREE.CanvasTexture(canvas);
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texturesToDispose.push(texture);
      return texture;
    }

    const planeGeo = new THREE.PlaneGeometry(0.55, 0.55);

    for (let i = 0; i < 20; i++) {
      const v0 = new THREE.Vector3(pos.getX(i * 3), pos.getY(i * 3), pos.getZ(i * 3));
      const v1 = new THREE.Vector3(pos.getX(i * 3 + 1), pos.getY(i * 3 + 1), pos.getZ(i * 3 + 1));
      const v2 = new THREE.Vector3(pos.getX(i * 3 + 2), pos.getY(i * 3 + 2), pos.getZ(i * 3 + 2));

      const center = new THREE.Vector3().add(v0).add(v1).add(v2).divideScalar(3);
      const normal = center.clone().normalize();
      faceCenters.push(center);
      faceNormals.push(normal);

      // Basis alignment so the face points straight (+Z) and stands upright (+Y)
      const planeQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(planeQuat);
      const localRight = new THREE.Vector3().crossVectors(localUp, normal).normalize();

      const m = new THREE.Matrix4().set(
        localRight.x, localRight.y, localRight.z, 0,
        localUp.x, localUp.y, localUp.z, 0,
        normal.x, normal.y, normal.z, 0,
        0, 0, 0, 1
      );
      const targetQ = new THREE.Quaternion().setFromRotationMatrix(m);
      faceTargetQuats.push(targetQ);

      const numTexture = createNumberTexture(i + 1);
      const planeMat = new THREE.MeshBasicMaterial({
        map: numTexture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        side: THREE.FrontSide,
      });
      materialsToDispose.push(planeMat);

      const plane = new THREE.Mesh(planeGeo, planeMat);
      plane.position.copy(center.clone().multiplyScalar(1.025));
      plane.quaternion.copy(planeQuat);
      diceGroup.add(plane);
      numberPlanes.push(plane);
    }

    // If initial target number is provided and not rolling, snap directly
    if (!isRolling && targetNumber !== null && targetNumber !== undefined) {
      const initVal = Math.max(1, Math.min(20, targetNumber));
      diceGroup.quaternion.copy(faceTargetQuats[initVal - 1]);
      hasSettledRef.current = true;
    }

    // 5. Animation Loop
    let animId: number;
    let time = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      time += 0.016;

      if (isRollingRef.current) {
        // Fast tumbling
        angularVelRef.current.x += (Math.random() - 0.5) * 0.04;
        angularVelRef.current.y += (Math.random() - 0.5) * 0.04;
        angularVelRef.current.z += (Math.random() - 0.5) * 0.04;
        angularVelRef.current.clampLength(0.16, 0.32);

        diceGroup.rotation.x += angularVelRef.current.x;
        diceGroup.rotation.y += angularVelRef.current.y;
        diceGroup.rotation.z += angularVelRef.current.z;
        diceGroup.position.y = Math.sin(time * 16) * 0.08;

        rimLight.color.setHex(0xf59e0b);
        rimLight.intensity = 3.2;
      } else if (targetNumberRef.current !== null && targetNumberRef.current !== undefined) {
        // Settle on specific target face
        const targetVal = Math.max(1, Math.min(20, targetNumberRef.current));
        const faceIndex = targetVal - 1;
        const targetQuat = faceTargetQuats[faceIndex];

        diceGroup.quaternion.slerp(targetQuat, 0.18);
        diceGroup.position.y += (0 - diceGroup.position.y) * 0.16;

        if (settleBounceRef.current > 1.0) {
          settleBounceRef.current += (1.0 - settleBounceRef.current) * 0.15;
          diceGroup.scale.setScalar(settleBounceRef.current);
        }

        // Outcome lighting
        if (targetVal === 20) {
          rimLight.color.setHex(0xffd700);
          rimLight.intensity = 5;
        } else if (targetVal === 1) {
          rimLight.color.setHex(0xef4444);
          rimLight.intensity = 5;
        } else if (targetDCRef.current && targetVal >= targetDCRef.current) {
          rimLight.color.setHex(0x10b981);
          rimLight.intensity = 4;
        } else if (targetDCRef.current && targetVal < targetDCRef.current) {
          rimLight.color.setHex(0xf43f5e);
          rimLight.intensity = 3.5;
        }

        const diff = 1 - Math.abs(diceGroup.quaternion.dot(targetQuat));
        if (diff < 0.001 && !hasSettledRef.current) {
          hasSettledRef.current = true;
          diceGroup.quaternion.copy(targetQuat);
          diceGroup.scale.setScalar(1.0);
          if (onSettleRef.current) {
            onSettleRef.current();
          }
        }
      } else {
        // Idle gentle float & rotation
        diceGroup.rotation.y += 0.008;
        diceGroup.rotation.x += 0.004;
        diceGroup.position.y = Math.sin(time * 2) * 0.04;
      }

      renderer.render(scene, camera);
    };

    animate();

    // 6. Cleanup
    return () => {
      cancelAnimationFrame(animId);
      baseGeo.dispose();
      bodyMaterial.dispose();
      edgesGeo.dispose();
      edgesMat.dispose();
      planeGeo.dispose();
      texturesToDispose.forEach((t) => t.dispose());
      materialsToDispose.forEach((m) => m.dispose());
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [size]);

  return (
    <div
      ref={mountRef}
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    />
  );
};
