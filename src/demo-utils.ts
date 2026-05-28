// === MODULE_CONTRACT ===
// FILE: src/demo-utils.ts
// VERSION: 1.0.0
// PURPOSE: Provide small MAGRA demo utility functions used by smoke tests.
// SCOPE: Greeting and arithmetic demo helpers.
// DEPENDS: M-MAGRA-RUNTIME-IDENTITY
// LINKS: docs/modules/M-MAGRA-RUNTIME-IDENTITY.xml
// ROLE: UTILITY
// MAP_MODE: EXPORTS
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Exports: greet, add
// Locals: none
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Updated demo greeting to use MAGRA Code identity.
// === END_CHANGE_SUMMARY ===

export function greet(name: string): string {
  return `Hello, ${name}! Welcome to MAGRA Code.`;
}

export function add(a: number, b: number): number {
  return a + b;
}
