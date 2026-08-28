import { create } from 'zustand';

export const GRID_SIZE = 50;
export const VERTEX_COUNT = (GRID_SIZE + 1) * (GRID_SIZE + 1);

const useMapStore = create((set, get) => ({
  // Editor State
  mode: 'none', // sculpt, paint, water, asset, decal, erase, select, none
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
  
  // Undo History
  history: [], // array of { heights: Float32Array, colors: Float32Array }

  // Map Data
  currentMapId: null,
  mapName: '새 맵',
  heights: new Float32Array(VERTEX_COUNT).fill(0),
  colors: new Float32Array(VERTEX_COUNT * 3).fill(1), // initialized to white or grass
  assets: [], // { id, type, position: [x,y,z] }
  decals: [], // { id, url, position: [x,y,z], scale: [x,y,z] }
  boundaries: [], // { id, start: [x,z], end: [x,z], condition: { type: 'item_count', itemType: 'rock', amount: 5 } }
  boundaryDrawing: null, // { start: [x,z], current: [x,z] }
  
  // Fluid Data (Dynamic Water)
  waterSources: [], // { x, z, amount }

  // Mini Game State
  mineMiniGame: { active: false, assetId: null, assetType: null },
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
  setMineMiniGame: (active, assetId = null, assetType = null) => set({ mineMiniGame: { active, assetId, assetType } }),
  setActiveDialogue: (active) => set({ activeDialogue: active }),
  
  saveHistory: () => set((state) => {
    const newHistory = [...state.history, { 
      heights: new Float32Array(state.heights), 
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
      heights: previousState.heights, 
      colors: previousState.colors, 
      history: newHistory 
    };
  }),
  
  loadMap: (mapData) => {
    // Parse jsonb arrays back to typed arrays
    const heights = new Float32Array(mapData.heights || VERTEX_COUNT);
    const colors = new Float32Array(mapData.colors || VERTEX_COUNT * 3);
    
    if (!mapData.colors || mapData.colors.length === 0) {
      // Default to green if no colors
      for(let i=0; i<VERTEX_COUNT*3; i+=3) {
        colors[i] = 0.24; // R
        colors[i+1] = 0.55; // G
        colors[i+2] = 0.25; // B
      }
    }

    set({
      currentMapId: mapData.id,
      mapName: mapData.name || '새 맵',
      heights,
      colors,
      assets: mapData.assets || [],
      decals: mapData.decals || [],
      boundaries: mapData.boundaries || [],
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
      heights: new Float32Array(VERTEX_COUNT).fill(0),
      colors,
      assets: [],
      decals: [],
      boundaries: [],
      history: [], // Reset history on new map
    });
  },

  updateHeights: (newHeights) => set({ heights: newHeights }),
  updateColors: (newColors) => set({ colors: newColors }),
  
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
  }))
}));

export default useMapStore;
