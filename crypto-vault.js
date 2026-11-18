/* Local encrypted vault for the Control de Horas pilot.
 * AES-256-GCM data encryption; PBKDF2-SHA-256 key wrapping.
 * No password, derived key, or recovery secret is persisted by this module.
 */
(() => {
  'use strict';
  const VERSION = 1;
  const ITERATIONS = 310000;
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  function bytesToBase64(bytes) {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }
  function base64ToBytes(value) {
    const binary = atob(value);
    return Uint8Array.from(binary, c => c.charCodeAt(0));
  }
  function randomBytes(length) {
    return crypto.getRandomValues(new Uint8Array(length));
  }
  async function deriveWrappingKey(secret, salt) {
    const material = await crypto.subtle.importKey(
      'raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      {name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256'},
      material, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']
    );
  }
  async function wrapMaster(masterRaw, secret) {
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const key = await deriveWrappingKey(secret, salt);
    const wrapped = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, masterRaw);
    return {salt: bytesToBase64(salt), iv: bytesToBase64(iv), wrapped: bytesToBase64(new Uint8Array(wrapped))};
  }
  async function unwrapMaster(record, secret) {
    const key = await deriveWrappingKey(secret, base64ToBytes(record.salt));
    return new Uint8Array(await crypto.subtle.decrypt(
      {name: 'AES-GCM', iv: base64ToBytes(record.iv)},
      key, base64ToBytes(record.wrapped)
    ));
  }
  function validateVault(vault) {
    return !!vault && vault.version === VERSION && vault.passwordWrap &&
      vault.recoveryWrap && vault.data && typeof vault.data.iv === 'string' &&
      typeof vault.data.ciphertext === 'string';
  }
  async function encryptWithMaster(masterRaw, value) {
    const key = await crypto.subtle.importKey('raw', masterRaw, 'AES-GCM', false, ['encrypt']);
    const iv = randomBytes(12);
    const plaintext = enc.encode(JSON.stringify(value));
    const ciphertext = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, plaintext);
    return {iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext))};
  }
  async function decryptWithMaster(masterRaw, data) {
    const key = await crypto.subtle.importKey('raw', masterRaw, 'AES-GCM', false, ['decrypt']);
    const plaintext = await crypto.subtle.decrypt(
      {name: 'AES-GCM', iv: base64ToBytes(data.iv)}, key, base64ToBytes(data.ciphertext)
    );
    return JSON.parse(dec.decode(plaintext));
  }
  function makeRecoveryCode() {
    // 192 bits of entropy; grouped only for readability.
    const hex = Array.from(randomBytes(24), b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    return hex.match(/.{1,8}/g).join('-');
  }
  async function create(password, initialData) {
    if (typeof password !== 'string' || password.length < 12) {
      throw new Error('La contraseña debe tener al menos 12 caracteres.');
    }
    const recoveryCode = makeRecoveryCode();
    const masterRaw = randomBytes(32);
    const [passwordWrap, recoveryWrap] = await Promise.all([
      wrapMaster(masterRaw, password),
      wrapMaster(masterRaw, recoveryCode.replaceAll('-', ''))
    ]);
    const data = await encryptWithMaster(masterRaw, initialData);
    return {
      vault: {version: VERSION, kdf: 'PBKDF2-SHA-256', iterations: ITERATIONS,
        cipher: 'AES-256-GCM', passwordWrap, recoveryWrap, data},
      recoveryCode,
      masterRaw
    };
  }
  async function unlockWithPassword(vault, password) {
    if (!validateVault(vault)) throw new Error('Almacén cifrado no válido.');
    const masterRaw = await unwrapMaster(vault.passwordWrap, password);
    const data = await decryptWithMaster(masterRaw, vault.data);
    return {masterRaw, data};
  }
  async function unlockWithRecovery(vault, recoveryCode) {
    if (!validateVault(vault)) throw new Error('Almacén cifrado no válido.');
    const normalized = String(recoveryCode).replaceAll('-', '').replaceAll(' ', '').toUpperCase();
    const masterRaw = await unwrapMaster(vault.recoveryWrap, normalized);
    const data = await decryptWithMaster(masterRaw, vault.data);
    return {masterRaw, data};
  }
  async function update(vault, masterRaw, value) {
    if (!validateVault(vault)) throw new Error('Almacén cifrado no válido.');
    return {...vault, data: await encryptWithMaster(masterRaw, value)};
  }
  async function changePassword(vault, masterRaw, newPassword) {
    if (typeof newPassword !== 'string' || newPassword.length < 12) {
      throw new Error('La contraseña debe tener al menos 12 caracteres.');
    }
    return {...vault, passwordWrap: await wrapMaster(masterRaw, newPassword)};
  }
  Object.defineProperty(window, 'LocalEncryptedVault', {
    value: Object.freeze({create, unlockWithPassword, unlockWithRecovery, update, changePassword}),
    configurable: false, writable: false
  });
})();
