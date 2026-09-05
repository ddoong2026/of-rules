export const getQuestId = (mapId, assetId, quest, index) =>
  JSON.stringify(['quest', mapId || null, assetId, quest.id || index]);

export const legacyQuestKey = (mapId, assetId, title) =>
  JSON.stringify(['legacy-quest', mapId || null, assetId, title]);

export function isQuestCompleted(completed, mapId, assetId, quests, index) {
  const quest = quests[index];
  if (completed.includes(getQuestId(mapId, assetId, quest, index))) return true;
  if (quest.type === 'RANDOM_MATH' && completed.includes(`random_math_${assetId}_${index}`)) return true;
  // Old logs only recorded titles. Assign ambiguous old completion to the first
  // matching quest, so it cannot also skip the second quest with the same title.
  return quests.findIndex(q => q.title === quest.title) === index &&
    (completed.includes(legacyQuestKey(mapId, assetId, quest.title)) || completed.includes(quest.title));
}

export function matchesActiveQuest(accepted, mapId, assetId, quest, index) {
  if (accepted.assetId !== assetId) return false;
  if (accepted.mapId != null && accepted.mapId !== mapId) return false;
  const id = getQuestId(mapId, assetId, quest, index);
  if (accepted.questId === id) return true;
  const oldId = quest.type === 'RANDOM_MATH' ? `random_math_${assetId}_${index}` : quest.title;
  return accepted.questId ? accepted.questId === oldId :
    (accepted.originalTitle || accepted.title) === quest.title;
}
