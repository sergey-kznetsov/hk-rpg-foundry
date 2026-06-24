// module/documents/actor.js
import { HK } from "../hk.js";

export class HKActor extends Actor {
  prepareDerivedData() {
    super.prepareDerivedData();

    const s = this.system ?? {};

    const pow = Number(s.stats?.pow?.value ?? 0);
    const grace = Number(s.stats?.grace?.value ?? 0);
    const shell = Number(s.stats?.shell?.value ?? 0);
    const insight = Number(s.stats?.insight?.value ?? 0);

    s.derived ??= {};
    s.derived.carry = Math.floor(pow);
    s.derived.maneuver = Math.ceil(grace / 2);
    s.derived.beltSlots = Math.floor(shell);
    s.derived.techSlots = Math.floor(insight);

    const armor = HK.getEquippedArmor(this);
    const durability = Number(armor?.system?.defense?.durability?.value ?? 0);
    const dr = Number(armor?.system?.defense?.dr ?? 0);
    s.derived.dr = (armor && durability > 0) ? dr : 0;

    const baseSpeed = Number(s.meta?.speed ?? 0);
    const speedDelta = HK.sumConditionModifier(this, "speedDelta");
    s.derived.speed = Math.max(0, baseSpeed + speedDelta);
  }
}
