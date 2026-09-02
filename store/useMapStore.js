import { create } from 'zustand';

export const GRID_SIZE = 50;
export const VERTEX_COUNT = (GRID_SIZE + 1) * (GRID_SIZE + 1);

const useMapStore = create((set, get) => ({
  // Editor State
  mode: 'none', // sculpt, paint, water, asset, decal, erase, select, carve, none
  brushSize: 2,
  brushIntensity: 1, // height change amount or paint opacity
  selectedColor: '#3d8c40', // default grass color
  selectedAsset: 'tree',
  selectedAssetId: null, // For editing properties in select mode
  selectedBoundaryId: null,
  selectedDecalImage: null,
  isCameraMode: false,
  isPlaying: false,
  sunTime: 12, // 0 to 24 hours
  transformMode: 'translate', // 'translate', 'rotate', 'scale'
  
  // Undo History
  history: [], // array of { heights: Float32Array, colors: Float32Array }

  // Map Data
  currentMapId: null,
  mapName: '새 맵',
  heightsBase: new Float32Array(VERTEX_COUNT).fill(0),
  heightsTop: new Float32Array(VERTEX_COUNT).fill(0), // 기본 높이 0
  heightsBottom: new Float32Array(VERTEX_COUNT).fill(0),
  heightsWater: new Float32Array(VERTEX_COUNT).fill(-0.01),
  colors: new Float32Array(VERTEX_COUNT * 3).fill(1), // initialized to white or grass
  assets: [], // { id, type, position: [x,y,z] }
  decals: [], // { id, url, position: [x,y,z], scale: [x,y,z] }
  csgOperations: [], // { id, type: 'subtract', position: [x,y,z], radius: r }
  boundaries: [], // { id, start: [x,z], end: [x,z], condition: { type: 'item_count', itemType: 'rock', amount: 5 } }
  boundaryDrawing: null, // { start: [x,z], current: [x,z] }
  spawnPoint: null, // { x, z }
  customItems: [], // { id, name, type (e.g. 'mineral', 'material', 'quest') }
  
  heights: new Float32Array(VERTEX_COUNT).fill(0), // Legacy single-layer heights

  // Fluid Data (Dynamic Water)
  waterSources: [], // { x, z, amount }

  // Mini Game State
  // Mini Game State
  mineMiniGame: { active: false, assetId: null, assetType: null },
  mathMiniGame: { active: false, questData: null },
  activeDialogue: false,

  // Actions
  setMode: (mode) => set({ mode }),
  setMapName: (name) => set({ mapName: name }),
  setBrushSize: (size) => set({ brushSize: size }),
  setBrushIntensity: (intensity) => set({ brushIntensity: intensity }),
  setSelectedColor: (color) => set({ selectedColor: color }),
  setSelectedAsset: (asset) => set({ selectedAsset: asset }),
  setSelectedAssetId: (id) => set({ selectedAssetId: id, selectedBoundaryId: null }),
  setSelectedBoundaryId: (id) => set({ selectedBoundaryId: id, selectedAssetId: null }),
  setSelectedDecalImage: (url) => set({ selectedDecalImage: url }),
  setCameraMode: (isCameraMode) => set({ isCameraMode }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setSunTime: (time) => set({ sunTime: time }),
  setSpawnPoint: (point) => set({ spawnPoint: point }),
  setMineMiniGame: (active, assetId = null, assetType = null) => set({ mineMiniGame: { active, assetId, assetType } }),
  setMathMiniGame: (state) => set({ mathMiniGame: { ...get().mathMiniGame, ...state } }),
  setActiveDialogue: (active) => set({ activeDialogue: active }),
  setTransformMode: (mode) => set({ transformMode: mode }),
  
  // Update functions
  updateHeightsBase: (h) => set({ heightsBase: h }),
  updateHeightsTop: (h) => set({ heightsTop: h }),
  updateHeightsBottom: (h) => set({ heightsBottom: h }),
  updateHeightsWater: (h) => set({ heightsWater: h }),
  updateColors: (c) => set({ colors: c }),
  updateHeights: (h) => set({ heights: h }), // Legacy update

  saveHistory: () => set((state) => {
    const newHistory = [...state.history, { 
      heightsBase: new Float32Array(state.heightsBase),
      heightsTop: new Float32Array(state.heightsTop), 
      heightsBottom: new Float32Array(state.heightsBottom), 
      heightsWater: new Float32Array(state.heightsWater),
      heights: new Float32Array(state.heights), // Legacy
      colors: new Float32Array(state.colors) 
    }];
    if (newHistory.length > 20) newHistory.shift(); // Keep max 20 states
    return { history: newHistory };
  }),

  undo: () => set((state) => {
    if (state.history.length === 0) return state;
    const newHistory = [...state.history];
    const previousState = newHistory.pop();
    return { 
      heightsBase: previousState.heightsBase,
      heightsTop: previousState.heightsTop, 
      heightsBottom: previousState.heightsBottom, 
      heightsWater: previousState.heightsWater,
      heights: previousState.heights, // Legacy
      colors: previousState.colors, 
      history: newHistory 
    };
  }),
  
  loadMap: (mapData) => {
    // Parse jsonb arrays back to typed arrays
    let heightsBase, heightsTop, heightsBottom, heightsWater, heightsLegacy;
    
    // Parse Top / Legacy Heights
    if (mapData.heights && !Array.isArray(mapData.heights) && mapData.heights.top !== undefined) {
      heightsTop = new Float32Array(mapData.heights.top);
      heightsLegacy = new Float32Array(mapData.heights.top); // sync for legacy
    } else if (Array.isArray(mapData.heights)) {
      heightsTop = new Float32Array(mapData.heights);
      heightsLegacy = new Float32Array(mapData.heights); // sync for legacy
    } else {
      heightsTop = new Float32Array(VERTEX_COUNT).fill(10);
      heightsLegacy = new Float32Array(VERTEX_COUNT).fill(10);
    }

    // Parse Base
    if (mapData.heights && !Array.isArray(mapData.heights) && mapData.heights.base !== undefined) {
      heightsBase = new Float32Array(mapData.heights.base);
    } else {
      heightsBase = new Float32Array(heightsTop); // Fallback to Top heights
    }

    // Parse Bottom (Cave Ceiling)
    if (mapData.heights && !Array.isArray(mapData.heights) && mapData.heights.bottom !== undefined) {
      heightsBottom = new Float32Array(mapData.heights.bottom);
    } else {
      heightsBottom = new Float32Array(heightsBase); // Fallback to Base heights (no cave)
    }

    // Parse Water
    if (mapData.heights && !Array.isArray(mapData.heights) && mapData.heights.water !== undefined) {
      heightsWater = new Float32Array(mapData.heights.water);
      // Migrate legacy water heights from 0 or -0.01 to -0.2
      for (let i = 0; i < heightsWater.length; i++) {
        if (Math.abs(heightsWater[i]) < 0.02 || Math.abs(heightsWater[i] - (-0.01)) < 0.02) {
          heightsWater[i] = -0.2;
        }
      }
    } else {
      heightsWater = new Float32Array(VERTEX_COUNT).fill(-0.2);
    }
    
    // Parse Colors
    let colors = new Float32Array(VERTEX_COUNT * 3);
    if (mapData.colors) {
      colors = new Float32Array(mapData.colors);
    } else {
      for (let i = 0; i < VERTEX_COUNT * 3; i += 3) {
        colors[i] = 0.24; colors[i + 1] = 0.55; colors[i + 2] = 0.25;
      }
    }

    set({
      currentMapId: mapData.id,
      mapName: mapData.name,
      heightsBase,
      heightsTop,
      heightsBottom,
      heightsWater,
      heights: heightsLegacy,
      colors,
      assets: mapData.assets || [],
      decals: mapData.decals || [],
      csgOperations: mapData.csgOperations || [],
      boundaries: mapData.boundaries || [],
      spawnPoint: mapData.spawnPoint || null,
      customItems: mapData.customItems || [],
      history: [], // Reset history on load
    });
  },
  
  resetMap: () => {
    const colors = new Float32Array(VERTEX_COUNT * 3);
    for(let i=0; i<VERTEX_COUNT*3; i+=3) {
      colors[i] = 0.24; colors[i+1] = 0.55; colors[i+2] = 0.25;
    }
    set({
      currentMapId: null,
      mapName: '새 맵',
      heightsBase: new Float32Array(VERTEX_COUNT).fill(0),
      heightsTop: new Float32Array(VERTEX_COUNT).fill(0),
      heightsBottom: new Float32Array(VERTEX_COUNT).fill(0),
      heightsWater: new Float32Array(VERTEX_COUNT).fill(-0.2), // 땅(0)보다 0.2 낮게 설정
      heights: new Float32Array(VERTEX_COUNT).fill(0), // Legacy
      colors,
      assets: [],
      decals: [],
      csgOperations: [],
      boundaries: [],
      spawnPoint: null,
      customItems: [],
      history: [], // Reset history on new map
    });
  },

  updateHeightsBase: (newHeights) => set({ heightsBase: newHeights }),
  updateHeightsTop: (newHeights) => set({ heightsTop: newHeights }),
  updateHeightsBottom: (newHeights) => set({ heightsBottom: newHeights }),
  updateHeightsWater: (newHeights) => set({ heightsWater: newHeights }),
  updateColors: (newColors) => set({ colors: newColors }),
  resetWaterToZero: () => set((state) => {
    state.saveHistory();
    return { heightsWater: new Float32Array(VERTEX_COUNT).fill(0) };
  }),
  
  addAsset: (asset) => set((state) => ({ assets: [...state.assets, asset] })),
  removeAsset: (id) => set((state) => ({ assets: state.assets.filter(a => a.id !== id), selectedAssetId: state.selectedAssetId === id ? null : state.selectedAssetId })),
  updateAsset: (id, updates) => set((state) => ({
    assets: state.assets.map(a => a.id === id ? { ...a, ...updates } : a)
  })),
  
  addDecal: (decal) => set((state) => ({ decals: [...state.decals, decal] })),
  removeDecal: (id) => set((state) => ({ decals: state.decals.filter(d => d.id !== id) })),
  
  addBoundary: (boundary) => set((state) => ({ boundaries: [...state.boundaries, boundary] })),
  removeBoundary: (id) => set((state) => ({ boundaries: state.boundaries.filter(b => b.id !== id), selectedBoundaryId: state.selectedBoundaryId === id ? null : state.selectedBoundaryId })),
  updateBoundary: (id, updates) => set((state) => ({
    boundaries: state.boundaries.map(b => b.id === id ? { ...b, ...updates } : b)
  })),
  setBoundaryDrawing: (data) => set({ boundaryDrawing: data }),
  
  addWaterSource: (x, z) => set((state) => ({
    waterSources: [...state.waterSources, { x, z, amount: 10 }]
  })),
  
  addCsgOperation: (op) => set((state) => ({ csgOperations: [...state.csgOperations, op] })),
  removeCsgOperation: (id) => set((state) => ({ csgOperations: state.csgOperations.filter(op => op.id !== id) })),

  addCustomItem: (item) => set((state) => ({ customItems: [...state.customItems, item] })),
  removeCustomItem: (id) => set((state) => ({ customItems: state.customItems.filter(i => i.id !== id) })),
  updateCustomItem: (id, updates) => set((state) => ({
    customItems: state.customItems.map(i => i.id === id ? { ...i, ...updates } : i)
  })),
}));

export default useMapStore;
