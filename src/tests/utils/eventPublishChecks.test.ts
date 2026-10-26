import { describe, it, expect } from 'vitest';
import {
  checkEventForPublication,
  PublishCheckTicket,
  UNLIMITED_STOCK_WARNING,
} from '../../lib/eventPublishChecks';

const NOW = new Date('2027-03-15T12:00:00Z');
const d = (iso: string) => iso;

// Festival 15 août 2027 — Full Pass : 80 € (01/02), 95 € (01/04), 110 € (01/06)
const event = { start_date: d('2027-08-15T18:00:00Z'), end_date: d('2027-08-17T23:00:00Z'), is_test: false };
const ticket = (overrides: Partial<PublishCheckTicket> = {}): PublishCheckTicket => ({
  name: 'Full Pass Homme',
  is_active: true,
  quantity_available: 300,
  sale_end_date: d('2027-08-10T22:00:00Z'),
  price_lock_enabled: true,
  price_lock_deposit_amount: 20,
  price_lock_opens_at: '',
  tiers: [
    { label: 'Early', price: 80, starts_at: d('2027-02-01T00:00:00Z'), ends_at: '' },
    { label: 'Regular', price: 95, starts_at: d('2027-04-01T00:00:00Z'), ends_at: '' },
    { label: 'Late', price: 110, starts_at: d('2027-06-01T00:00:00Z'), ends_at: '' },
  ],
  ...overrides,
});

const check = (tickets: PublishCheckTicket[], ev = event) => checkEventForPublication(ev, tickets, NOW);

describe('checkEventForPublication', () => {
  it('festival complet et cohérent : publiable sans avertissement', () => {
    expect(check([ticket()])).toEqual({ errors: [], warnings: [] });
  });

  it('aucun billet actif', () => {
    expect(check([ticket({ is_active: false })]).errors.join()).toMatch(/Aucun billet actif/);
  });

  it('aucun palier en cours', () => {
    const tiers = ticket().tiers.slice(1); // premier palier le 01/04
    expect(check([ticket({ tiers })]).errors.join()).toMatch(/aucun palier en cours/);
  });

  it('Price Lock activé sans palier futur', () => {
    const tiers = [{ label: 'Unique', price: 80, starts_at: d('2027-02-01T00:00:00Z'), ends_at: '' }];
    expect(check([ticket({ tiers })]).errors.join()).toMatch(/sans palier futur/);
    // Sans Price Lock, un palier unique est valide
    expect(check([ticket({ tiers, price_lock_enabled: false })]).errors).toEqual([]);
  });

  it('prix qui baisse', () => {
    const tiers = ticket().tiers.map((t) => (t.label === 'Late' ? { ...t, price: 90 } : t));
    expect(check([ticket({ tiers })]).errors.join()).toMatch(/le prix baisse entre « Regular » et « Late »/);
  });

  it('palier après le début de l’événement', () => {
    const tiers = [...ticket().tiers, { label: 'Sur place', price: 130, starts_at: d('2027-08-16T00:00:00Z'), ends_at: '' }];
    expect(check([ticket({ tiers })]).errors.join()).toMatch(/commence après le début de l’événement/);
  });

  it('fin des ventes passée ou après le début de l’événement', () => {
    expect(check([ticket({ sale_end_date: d('2027-03-01T00:00:00Z') })]).errors.join()).toMatch(/fin des ventes est déjà passée/);
    expect(check([ticket({ sale_end_date: d('2027-08-16T00:00:00Z') })]).errors.join()).toMatch(/fin des ventes est après le début/);
  });

  it('dates de l’événement incohérentes ou passées', () => {
    expect(check([ticket()], { ...event, end_date: d('2027-08-14T00:00:00Z') }).errors.join()).toMatch(/fin de l’événement doit être après/);
    expect(check([ticket()], { ...event, start_date: d('2027-03-01T00:00:00Z'), end_date: '' }).errors.join()).toMatch(/déjà commencé ou est passé/);
  });

  it('versement minimum : 20 € hors test, et inférieur au prix actuel', () => {
    expect(check([ticket({ price_lock_deposit_amount: 10 })]).errors.join()).toMatch(/au moins 20 €/);
    // Événement de test : pas de minimum de 20 €
    expect(check([ticket({ price_lock_deposit_amount: 10 })], { ...event, is_test: true }).errors).toEqual([]);
    expect(check([ticket({ price_lock_deposit_amount: 80 })]).errors.join()).toMatch(/inférieur au prix actuel \(80 €\)/);
  });

  it('ouverture du Price Lock après la prochaine hausse', () => {
    expect(check([ticket({ price_lock_opens_at: d('2027-04-02T00:00:00Z') })]).errors.join()).toMatch(/doit précéder la prochaine hausse \(Regular\)/);
    expect(check([ticket({ price_lock_opens_at: d('2027-03-20T00:00:00Z') })]).errors).toEqual([]);
  });

  it('stock : vide = illimité (avertissement), 0 = bloquant', () => {
    const unlimited = check([ticket({ quantity_available: null })]);
    expect(unlimited.errors).toEqual([]);
    expect(unlimited.warnings).toEqual([`Billet « Full Pass Homme » : ${UNLIMITED_STOCK_WARNING}`]);
    expect(check([ticket({ quantity_available: 0 })]).errors.join()).toMatch(/stock est à 0/);
  });

  it('ignore les paliers supprimés et les billets inactifs', () => {
    const tiers = [...ticket().tiers, { label: 'Erreur', price: 10, starts_at: d('2027-05-01T00:00:00Z'), ends_at: '', _delete: true }];
    expect(check([ticket({ tiers }), ticket({ name: 'Ancien', is_active: false, tiers: [] })]).errors).toEqual([]);
  });
});
