import { create } from 'zustand';

// Generate a default flat terrain (e.g. 20x20)
const generateInitialBlocks = () => {
  const blocks = new Map();
  for (let x = -10; x < 10; x++) {
    for (let z = -10; z < 10; z++) {
      blocks.set(`${x},0,${z}`, { color: '#3d8c40' });
    }
  }
  return blocks;
};

const useVoxelStore = create((set) => ({
  blocks: generateInitialBlocks(), // Map of "x,y,z" -> { color }
  mode: 'build', // 'build', 'dig', 'paint'
  selectedColor: '#3d8c40',
  isCameraMode: false,
  
  // History for Undo
  history: [],
  
  setMode: (mode) => set({ mode }),
  setSelectedColor: (color) => set({ selectedColor: color }),
  setCameraMode: (isCameraMode) => set({ isCameraMode }),
  
  saveHistory: () => set((state) => {
    // Save a copy of the current blocks map
    const newHistory = [...state.history, new Map(state.blocks)];
    if (newHistory.length > 20) newHistory.shift();
    return { history: newHistory };
  }),
  
  undo: () => set((state) => {
    if (state.history.length === 0) return state;
    const previousBlocks = state.history[state.history.length - 1];
    return { 
      blocks: previousBlocks, 
      history: state.history.slice(0, -1) 
    };
  }),

  addBlock: (x, y, z, color) => set((state) => {
    const key = `${x},${y},${z}`;
    if (state.blocks.has(key)) return state;
    const newBlocks = new Map(state.blocks);
    newBlocks.set(key, { color });
    return { blocks: newBlocks };
  }),

  removeBlock: (x, y, z) => set((state) => {
    const key = `${x},${y},${z}`;
    if (!state.blocks.has(key)) return state;
    const newBlocks = new Map(state.blocks);
    newBlocks.delete(key);
    return { blocks: newBlocks };
  }),

  paintBlock: (x, y, z, color) => set((state) => {
    const key = `${x},${y},${z}`;
    if (!state.blocks.has(key)) return state;
    const newBlocks = new Map(state.blocks);
    newBlocks.set(key, { color });
    return { blocks: newBlocks };
  }),
  
  clearMap: () => set({ blocks: new Map(), history: [] })
}));

export default useVoxelStore;
