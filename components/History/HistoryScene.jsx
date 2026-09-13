'use client';

import { Component, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';

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
export default function HistoryScene({step,onFailure}) {
  return <SceneBoundary onFailure={onFailure}><Canvas frameloop="demand" dpr={1} camera={{position:[0,1.6,6],fov:55,near:.1,far:40}} gl={{antialias:false,powerPreference:'low-power'}} fallback={<p>3D 미지원 환경입니다. 텍스트 대체 흐름을 선택해 주세요.</p>}>
    <color attach="background" args={['#dce8e1']}/><fog attach="fog" args={['#dce8e1',15,35]}/>
    <ambientLight intensity={1.6}/><directionalLight position={[5,8,3]} intensity={2}/>
    <mesh rotation={[-Math.PI/2,0,0]}><planeGeometry args={[30,30]}/><meshLambertMaterial color="#9da88a"/></mesh>
    {[-6,-3,0,3,6].map((x,i)=><group key={x} position={[x,0,-1]}><mesh position={[0,.5,0]}><boxGeometry args={[1.1,1,1.1]}/><meshLambertMaterial color={i%2?'#bdb89c':'#c9c5ae'}/></mesh><mesh position={[0,1.5,0]}><icosahedronGeometry args={[.4,0]}/><meshLambertMaterial color={i%2?'#ba8e60':'#647f68'}/></mesh></group>)}
    <mesh position={[0,.015,4]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[1.5,8]}/><meshLambertMaterial color="#ddd0ac"/></mesh>
    <Camera step={step} onFailure={onFailure}/>
  </Canvas></SceneBoundary>;
}
