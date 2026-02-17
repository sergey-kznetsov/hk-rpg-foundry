import { HK } from "../hk.js";

export class HKActor extends Actor {
  prepareDerivedData() {
    super.prepareDerivedData();
    const s = this.system;

    // Derived: carry=floor(pow), maneuver=ceil(grace/2), beltSlots=floor(shell), techSlots=floor(insight)
    const pow = Number(s.stats?.pow?.value ?? 0);
    const grace = Number(s.stats?.grace?.value ?? 0);
    const shell = Number(s.stats?.shell?.value ?? 0);
    const insight = Number(s.stats?.insight?.value ?? 0);

    s.derived = s.derived ?? {};
    s.derived.carry = Math.floor(pow);
    s.derived.maneuver = Math.ceil(grace / 2);
    s.derived.beltSlots = Math.floor(shell);
    s.derived.techSlots = Math.floor(insight);

    // DR from armor (MVP: first usable armor)
    const armor = HK.getEquippedArmor(this);
    const dr = Number(armor?.system?.defense?.dr ?? 0);
    s.derived.dr = (armor && (armor.system?.defense?.durability?.value ?? 0) > 0) ? dr : 0;
  }
}