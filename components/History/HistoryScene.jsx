'use client';

import { Component, Suspense, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';

class SceneBoundary extends Component {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(){this.props.onFailure();}
  render(){return this.state.failed?<p>3D를 실행하지 못해 같은 단서의 텍스트 흐름으로 전환합니다.</p>:this.props.children;}
}
function Camera({step,onFailure}) {
  const {camera,gl,invalidate}=useThree();
  useEffect(()=>{
    camera.position.set(step<3?0:3,1.6,step<3?6:4);camera.lookAt(step<3?0:3,1.2,0);invalidate();
  },[step,camera,invalidate]);
  useEffect(()=>{
    const canvas=gl.domElement;let drag=null;
    const down=e=>{drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);};
    const move=e=>{if(!drag)return;camera.rotation.order='YXZ';camera.rotation.y-=(e.clientX-drag.x)*.003;camera.rotation.x=Math.max(-.6,Math.min(.6,camera.rotation.x-(e.clientY-drag.y)*.003));drag={x:e.clientX,y:e.clientY};invalidate();};
    const up=()=>{drag=null;};
    const key=e=>{
      if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(e.key))return;
      e.preventDefault();
      if(['ArrowUp','w'].includes(e.key))camera.translateZ(-.35);
      if(['ArrowDown','s'].includes(e.key))camera.translateZ(.35);
      if(['ArrowLeft','a'].includes(e.key))camera.translateX(-.35);
      if(['ArrowRight','d'].includes(e.key))camera.translateX(.35);
      camera.position.x=Math.max(-5,Math.min(5,camera.position.x));camera.position.z=Math.max(2,Math.min(8,camera.position.z));camera.position.y=1.6;invalidate();
    };
    const lost=e=>{e.preventDefault();onFailure();};
    canvas.setAttribute('tabindex','0');canvas.setAttribute('aria-label','1인칭 공간. 방향키로 짧게 이동하고 드래그로 둘러봅니다.');
    canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('keydown',key);canvas.addEventListener('webglcontextlost',lost);
    return()=>{canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('keydown',key);canvas.removeEventListener('webglcontextlost',lost);};
  },[camera,gl,invalidate,onFailure]);
  return null;
}
function Guide() {
  const {scene}=useGLTF('/history/character-web.glb');
  return <primitive object={scene} position={[0,0,0]} dispose={null}/>;
}
function Hut({position}) {
  return <group position={position}><mesh position={[0,.8,0]}><cylinderGeometry args={[1.25,1.3,1.6,8]}/><meshLambertMaterial color="#b8a780"/></mesh><mesh position={[0,2,0]}><coneGeometry args={[1.9,1.5,8]}/><meshLambertMaterial color="#a58951"/></mesh><mesh position={[0,.6,1.22]}><boxGeometry args={[.65,1.2,.1]}/><meshLambertMaterial color="#4d4939"/></mesh></group>;
}
export default function HistoryScene({step,onFailure,pathId}) {
  return <SceneBoundary onFailure={onFailure}><Canvas frameloop="demand" dpr={1} camera={{position:[0,1.6,6],fov:55,near:.1,far:40}} gl={{antialias:false,powerPreference:'low-power'}} fallback={<p>3D 미지원 환경입니다. 텍스트 대체 흐름을 선택해 주세요.</p>}>
    <color attach="background" args={['#dce8e1']}/><fog attach="fog" args={['#dce8e1',15,35]}/>
    <ambientLight intensity={1.6}/><directionalLight position={[5,8,3]} intensity={2}/>
    <mesh rotation={[-Math.PI/2,0,0]}><planeGeometry args={[30,30]}/><meshLambertMaterial color="#9da88a"/></mesh>
    <mesh position={[-8,-.015,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[6,30]}/><meshLambertMaterial color="#7ba9ae"/></mesh>
    {pathId==='1-A'?<group position={[-3,0,-3]}>{[-1,1].map(x=><mesh key={x} position={[x,1,0]}><icosahedronGeometry args={[1.6,0]}/><meshLambertMaterial color="#98998b"/></mesh>)}<mesh position={[0,2.3,0]}><icosahedronGeometry args={[1.8,0]}/><meshLambertMaterial color="#929789"/></mesh></group>:<><Hut position={[-3,0,-5]}/><Hut position={[5,0,-5]}/></>}
    {[[-6,-8,1],[-3,-10,1.3],[1,-9,1],[7,-9,1.2],[9,-4,1],[8,3,.8],[-9,-12,1.3]].map(([x,z,size])=><group key={x} position={[x,0,z]} scale={size}><mesh position={[0,1,0]}><cylinderGeometry args={[.14,.25,2,5]}/><meshLambertMaterial color="#79684a"/></mesh><mesh position={[0,2.5,0]}><icosahedronGeometry args={[1.5,0]}/><meshLambertMaterial color="#688266"/></mesh></group>)}
    <Suspense fallback={null}><Guide/></Suspense>
    <mesh position={[0,.015,4]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[1.5,8]}/><meshLambertMaterial color="#ddd0ac"/></mesh>
    <Camera step={step} onFailure={onFailure}/>
  </Canvas></SceneBoundary>;
}
