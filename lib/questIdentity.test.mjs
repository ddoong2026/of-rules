import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import useInventoryStore from '../store/useInventoryStore.js';
import { getQuestId, isQuestCompleted, matchesActiveQuest, legacyQuestKey } from './questIdentity.mjs';

const quests = [{ title: '나무 모으기' }, { title: '나무 모으기' }];
const id = i => getQuestId('map', 'npc', quests[i], i);
beforeEach(() => useInventoryStore.setState({ items: Array(36).fill(null), activeQuests: [], completedQuests: [] }));

test('first quest reward preserves second quest and each reward can be completed separately', () => {
  const store = useInventoryStore.getState();
  for (let i = 0; i < 2; i++) assert.equal(store.acceptQuest({ assetId: 'npc', mapId: 'map', questId: id(i), title: quests[i].title }), true);
  assert.equal(store.acceptQuest({ assetId: 'npc', questId: id(0) }), false);
  store.addItem('tree', 3);
  assert.equal(store.consumeItem('tree', 3), true);
  store.addItem('rock', 2);
  store.completeQuest('npc', id(0));
  store.addCompletedQuest(id(0));
  let state = useInventoryStore.getState();
  assert.deepEqual(state.activeQuests.map(q => q.questId), [id(1)]);
  assert.equal(isQuestCompleted(state.completedQuests, 'map', 'npc', quests, 0), true);
  assert.equal(isQuestCompleted(state.completedQuests, 'map', 'npc', quests, 1), false);
  assert.equal(state.items.filter(Boolean)[0].count, 2);
  store.completeQuest('npc', id(1));
  store.addCompletedQuest(id(1));
  assert.equal(isQuestCompleted(useInventoryStore.getState().completedQuests, 'map', 'npc', quests, 1), true);
});

test('math progress updates only the requested quest', () => {
  const store = useInventoryStore.getState();
  for (let i = 0; i < 2; i++) store.acceptQuest({ assetId: 'npc', questId: id(i), mathSolvedCount: 0 });
  store.updateActiveQuest('npc', id(0), { mathSolvedCount: 1 });
  assert.deepEqual(useInventoryStore.getState().activeQuests.map(q => q.mathSolvedCount), [1, 0]);
});

test('quest identities separate maps, NPCs, and duplicate titles', () => {
  assert.notEqual(id(0), id(1));
  assert.notEqual(id(0), getQuestId('other-map', 'npc', quests[0], 0));
  assert.notEqual(id(0), getQuestId('map', 'other-npc', quests[0], 0));
  assert.equal(matchesActiveQuest({ assetId: 'npc', questId: id(1) }, 'map', 'npc', quests[0], 0), false);
});

test('old completion logs do not mark both same-title quests complete', () => {
  const completed = [legacyQuestKey('map', 'npc', quests[0].title)];
  assert.equal(isQuestCompleted(completed, 'map', 'npc', quests, 0), true);
  assert.equal(isQuestCompleted(completed, 'map', 'npc', quests, 1), false);
  assert.equal(isQuestCompleted(completed, 'map', 'other-npc', quests, 0), false);
  assert.equal(matchesActiveQuest({ assetId: 'npc', questId: quests[0].title }, 'map', 'npc', quests[0], 0), true);
});

test('restored completion IDs preserve the first reward without skipping the second', () => {
  const store = useInventoryStore.getState();
  store.setCompletedQuests(JSON.parse(JSON.stringify([id(0)])));
  const completed = useInventoryStore.getState().completedQuests;
  assert.equal(isQuestCompleted(completed, 'map', 'npc', quests, 0), true);
  assert.equal(isQuestCompleted(completed, 'map', 'npc', quests, 1), false);
});
