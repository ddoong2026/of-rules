import { create } from 'zustand';

const INVENTORY_SIZE = 36;
const HOTBAR_SIZE = 9;

const useInventoryStore = create((set, get) => ({
  items: Array(INVENTORY_SIZE).fill(null),
  selectedSlot: 0,
  isOpen: false,
  activeQuests: [], // { assetId, title, requireItem, requireAmount, rewardItem, rewardAmount }
  completedQuests: [], // Array of quest titles

  setCompletedQuests: (quests) => set({ completedQuests: quests }),
  resetQuests: () => set({ activeQuests: [], completedQuests: [] }),
  addCompletedQuest: (title) => set((state) => {
    if (state.completedQuests.includes(title)) return state;
    return { completedQuests: [...state.completedQuests, title] };
  }),

  setSlot: (index) => set({ selectedSlot: index }),
  
  toggleInventory: () => set((state) => ({ isOpen: !state.isOpen })),
  
  setIsOpen: (isOpen) => set({ isOpen }),

  addItem: (type, amount = 1) => set((state) => {
    const newItems = [...state.items];
    
    // 1. 먼저 동일한 타입의 아이템이 있고 64개 미만인 슬롯을 찾음
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      if (newItems[i] && newItems[i].type === type && newItems[i].count < 64) {
        const spaceLeft = 64 - newItems[i].count;
        if (amount <= spaceLeft) {
          newItems[i] = { ...newItems[i], count: newItems[i].count + amount };
          return { items: newItems };
        } else {
          newItems[i] = { ...newItems[i], count: 64 };
          amount -= spaceLeft;
        }
      }
    }
    
    // 2. 남은 양이 있다면 빈 슬롯을 찾아서 넣음
    if (amount > 0) {
      for (let i = 0; i < INVENTORY_SIZE; i++) {
        if (newItems[i] === null) {
          newItems[i] = { type, count: amount };
          return { items: newItems };
        }
      }
    }
    
    // 인벤토리가 가득 찼으면 무시
    return { items: newItems };
  }),

  // 아이템 스왑 기능 (추후 드래그앤드롭 등에 사용)
  swapItems: (index1, index2) => set((state) => {
    const newItems = [...state.items];
    const temp = newItems[index1];
    newItems[index1] = newItems[index2];
    newItems[index2] = temp;
    return { items: newItems };
  }),

  // 아이템 소비 (퀘스트 완료 등에 사용)
  consumeItem: (type, amount = 1) => {
    let success = false;
    set((state) => {
      let remaining = amount;
      const newItems = [...state.items];
      
      // 인벤토리를 순회하며 해당 아이템 차감
      for (let i = 0; i < INVENTORY_SIZE; i++) {
        if (newItems[i] && newItems[i].type === type) {
          if (newItems[i].count > remaining) {
            newItems[i] = { ...newItems[i], count: newItems[i].count - remaining };
            remaining = 0;
            break;
          } else {
            remaining -= newItems[i].count;
            newItems[i] = null;
          }
        }
      }
      
      if (remaining === 0) {
        success = true;
        return { items: newItems };
      } else {
        // 아이템이 부족하면 변경 취소
        success = false;
        return state;
      }
    });
    return success;
  },
  
  // 퀘스트 관리
  acceptQuest: (questData) => {
    let accepted = false;
    set((state) => {
      const questKey = questData.questId || questData.title;
      const alreadyAccepted = state.activeQuests.some((quest) =>
        quest.assetId === questData.assetId &&
        (quest.questId || quest.title) === questKey
      );

      if (alreadyAccepted) return state;
      accepted = true;
      return { activeQuests: [...state.activeQuests, questData] };
    });
    return accepted;
  },
  updateActiveQuest: (assetId, questId, newData) => set((state) => ({
    activeQuests: state.activeQuests.map(q => q.assetId === assetId && (q.questId || q.title) === questId ? { ...q, ...newData } : q)
  })),
  completeQuest: (assetId, questId) => set((state) => ({
    activeQuests: state.activeQuests.filter(q => q.assetId !== assetId || (q.questId || q.title) !== questId)
  })),
}));

export default useInventoryStore;
