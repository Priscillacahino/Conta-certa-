import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePrivateProfile, privateProfileSummary } from '../src/private-profile.js';

const base = {
  schemaVersion: 1,
  residential: { id: 'brise', name: 'Residencial Brise', address: 'Endereço privado' },
  units: [
    { id:'101', responsibleName:'Pessoa 101', contacts:[{type:'phone',value:'+5583999991111'}], active:true },
    { id:'202', responsibleName:'Pessoa 202', contacts:[{type:'phone',value:'+5583999992222'},{type:'phone',value:'+19789999999'}], active:true },
  ],
};

test('normaliza cadastro privado e preserva múltiplos telefones', () => {
  const profile = normalizePrivateProfile(base);
  assert.equal(profile.units[1].contacts.length, 2);
  assert.equal(profile.units[0].label, 'Apartamento 101');
});

test('resumo contabiliza unidades e telefones', () => {
  const summary = privateProfileSummary(base);
  assert.equal(summary.unitCount, 2);
  assert.equal(summary.phoneCount, 3);
});

test('rejeita unidade duplicada', () => {
  assert.throws(() => normalizePrivateProfile({...base, units:[base.units[0], {...base.units[0]}]}), /UNIDADE_DUPLICADA/);
});

test('rejeita telefone inválido', () => {
  const bad = structuredClone(base);
  bad.units[0].contacts[0].value = '123';
  assert.throws(() => normalizePrivateProfile(bad), /TELEFONE_INVALIDO/);
});


test('minimização descarta campos privados não previstos', () => {
  const profile = normalizePrivateProfile({
    ...base,
    residential:{...base.residential, bankAccount:'nao-deve-ser-preservido'},
    units:[{...base.units[0], cpf:'00000000000', notes:'segredo'}]
  });
  assert.equal('bankAccount' in profile.residential, false);
  assert.equal('cpf' in profile.units[0], false);
  assert.equal('notes' in profile.units[0], false);
});

test('resumo ignora telefone inativo', () => {
  const input=structuredClone(base);
  input.units[0].contacts[0].active=false;
  assert.equal(privateProfileSummary(input).phoneCount,2);
});
