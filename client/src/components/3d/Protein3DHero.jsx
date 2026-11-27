import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export const Protein3DHero = () => {
  const mountRef = useRef(null);
  const [motionReduced, setMotionReduced] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setMotionReduced(prefersReducedMotion);

    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || 320;
    const height = container.clientHeight || 340;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 7.5);

    // Renderer
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      container.appendChild(renderer.domElement);
    } catch (err) {
      console.warn("WebGL unavailable or error:", err);
      setLoadError(true);
      return;
    }

    // Protein Container Group
    const productGroup = new THREE.Group();
    scene.add(productGroup);

    // 1. Tub Body (Cylinder)
    const tubGeo = new THREE.CylinderGeometry(1.2, 1.15, 2.8, 32);
    const tubMat = new THREE.MeshStandardMaterial({
      color: 0x0f1517,
      roughness: 0.35,
      metalness: 0.8,
    });
    const tub = new THREE.Mesh(tubGeo, tubMat);
    tub.position.y = 0;
    productGroup.add(tub);

    // 2. Tub Lid
    const lidGeo = new THREE.CylinderGeometry(1.25, 1.25, 0.45, 32);
    const lidMat = new THREE.MeshStandardMaterial({
      color: 0x080b0d,
      roughness: 0.2,
      metalness: 0.9,
    });
    const lid = new THREE.Mesh(lidGeo, lidMat);
    lid.position.y = 1.55;
    productGroup.add(lid);

    // 3. Neon Label Banner / Ring
    const labelGeo = new THREE.CylinderGeometry(1.21, 1.16, 1.5, 32, 1, true);
    const labelMat = new THREE.MeshStandardMaterial({
      color: 0x151d1f,
      roughness: 0.6,
      metalness: 0.3,
    });
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.position.y = -0.1;
    productGroup.add(labelMesh);

    // 4. Glowing Neon Energy Ring around container
    const ringGeo = new THREE.TorusGeometry(1.9, 0.035, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xb8f36b,
      transparent: true,
      opacity: 0.85,
    });
    const energyRing = new THREE.Mesh(ringGeo, ringMat);
    energyRing.rotation.x = Math.PI / 2.3;
    energyRing.position.y = -0.4;
    scene.add(energyRing);

    // 5. Floating Green Ambient Particles
    const particleCount = 45;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 6;
      particlePositions[i + 1] = (Math.random() - 0.5) * 5;
      particlePositions[i + 2] = (Math.random() - 0.5) * 4;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xb8f36b,
      size: 0.05,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // Key Light - Neon Lime
    const neonKeyLight = new THREE.PointLight(0xb8f36b, 2.5, 12);
    neonKeyLight.position.set(3, 2.5, 3);
    scene.add(neonKeyLight);

    // Rim Light - Cool White
    const rimLight = new THREE.DirectionalLight(0xdcf8c6, 1.8);
    rimLight.position.set(-4, 3, -2);
    scene.add(rimLight);

    // Soft Bottom Glow
    const bottomGlow = new THREE.PointLight(0x8bd63d, 1.2, 8);
    bottomGlow.position.set(0, -2.5, 2);
    scene.add(bottomGlow);

    // Animation Loop
    let animationFrameId;
    let clock = new THREE.Clock();

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();

      if (!prefersReducedMotion) {
        // Slow continuous revolving rotation
        productGroup.rotation.y = elapsedTime * 0.45;
        // Subtle vertical floating bob
        productGroup.position.y = Math.sin(elapsedTime * 1.2) * 0.08;

        // Energy ring slow precession
        energyRing.rotation.z = -elapsedTime * 0.3;
        energyRing.position.y = -0.4 + Math.sin(elapsedTime * 0.8) * 0.05;

        // Subtle particle drift
        particles.rotation.y = elapsedTime * 0.05;
      }

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    // Handle Resize
    const handleResize = () => {
      if (!container || !renderer) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (renderer && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
        renderer.dispose();
      }
    };
  }, []);

  if (loadError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-32 h-44 rounded-2xl bg-gradient-to-b from-bg-card to-bg-secondary border-2 border-accent-primary/40 flex flex-col items-center justify-between p-3 shadow-neon">
          <div className="w-16 h-4 bg-bg-primary rounded-t-md border border-border-theme" />
          <div className="text-accent-primary font-black text-xs tracking-wider">CHAVA ISO 100%</div>
          <div className="w-10 h-1 bg-accent-primary rounded-full" />
        </div>
        <span className="text-xs text-text-muted mt-3">CHAVA PRO NUTRITION</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[320px] sm:h-[380px] lg:h-[440px] flex items-center justify-center select-none overflow-hidden">
      {/* Background radial gradient glow */}
      <div className="absolute inset-0 bg-radial-glow pointer-events-none opacity-40" />
      <div 
        ref={mountRef} 
        className="w-full h-full cursor-grab active:cursor-grabbing" 
        aria-label="3D Protein Supplement Centerpiece"
      />
      {/* Branding overlay tag */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-bg-primary/80 backdrop-blur-md border border-accent-primary/30 text-[11px] font-semibold tracking-wider text-accent-primary flex items-center gap-1.5 shadow-neon">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-pulse" />
        CHAVA PERFORMANCE CORE
      </div>
    </div>
  );
};
