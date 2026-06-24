// module/documents/actor.js
import { HK } from "../hk.js";
import { calculateEffectiveSystem } from "../mechanics/effects.js";

export class HKActor extends Actor {
  prepareDerivedData() {
    super.prepareDerivedData();

    const s = this.system ?? {};
    s.effective = calculateEffectiveSystem(this);

    const pow = Number(s.effective?.stats?.pow?.value ?? s.stats?.pow?.value ?? 0);
    const grace = Number(s.effective?.stats?.grace?.value ?? s.stats?.grace?.value ?? 0);
    const shell = Number(s.effective?.stats?.shell?.value ?? s.stats?.shell?.value ?? 0);
    const insight = Number(s.effective?.stats?.insight?.value ?? s.stats?.insight?.value ?? 0);

    s.derived ??= {};
    s.derived.carry = Math.floor(pow);
    s.derived.maneuver = Math.ceil(grace / 2);
    s.derived.beltSlots = Math.floor(shell);
    s.derived.techSlots = Math.floor(insight);

    const armor = HK.getEquippedArmor(this);
    const durability = Number(armor?.system?.defense?.durability?.value ?? 0);
    const dr = Number(armor?.system?.defense?.dr ?? 0);
    s.derived.dr = (armor && durability > 0) ? dr : 0;

    const baseSpeed = Number(s.effective?.meta?.speed ?? s.meta?.speed ?? 0);
    const speedDelta = HK.sumConditionModifier(this, "speedDelta");
    s.derived.speed = Math.max(0, baseSpeed + speedDelta);

    const equippedMarks = this.items
      .filter(i => i.type === "charm" && i.system?.equipped === true)
      .reduce((total, charm) => total + Number(charm.system?.marks ?? 0), 0);
    const marksMax = Number(s.effective?.meta?.marks?.max ?? s.meta?.marks?.max ?? 0);
    s.derived.equippedMarks = equippedMarks;
    s.derived.freeMarks = Math.max(0, marksMax - equippedMarks);
    s.derived.activeEffects = Array.isArray(s.effective?.effects) ? s.effective.effects.length : 0;
  }
}
