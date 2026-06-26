// src/__tests__/agent.test.ts

import { describe, it, expect } from "vitest";
import { AgentValidators } from "@/lib/agent/validators";

describe("Agent Validators", () => {
  describe("validatePrompt", () => {
    it("should allow valid prompts", () => {
      const result = AgentValidators.validatePrompt("Quantos exames foram feitos hoje?");
      expect(result.valid).toBe(true);
    });

    it("should block prompts with blocked keywords", () => {
      const result = AgentValidators.validatePrompt("Como funciona o codigo?");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("codigo");
    });

    it("should reject prompts with password keyword", () => {
      const result = AgentValidators.validatePrompt("Qual é a senha do admin?");
      expect(result.valid).toBe(false);
    });

    it("should reject very short prompts", () => {
      const result = AgentValidators.validatePrompt("oi");
      expect(result.valid).toBe(false);
    });

    it("should reject very long prompts", () => {
      const result = AgentValidators.validatePrompt("a".repeat(501));
      expect(result.valid).toBe(false);
    });
  });

  describe("validateSQL", () => {
    it("should allow valid SELECT queries", () => {
      const sql = "SELECT * FROM pacientes WHERE tenant_id = $1";
      const result = AgentValidators.validateSQL(sql);
      expect(result.valid).toBe(true);
    });

    it("should block DELETE queries", () => {
      const sql = "DELETE FROM pacientes WHERE id = 1";
      const result = AgentValidators.validateSQL(sql);
      expect(result.valid).toBe(false);
    });

    it("should block queries without WHERE", () => {
      const sql = "SELECT * FROM pacientes";
      const result = AgentValidators.validateSQL(sql);
      expect(result.valid).toBe(false);
    });

    it("should block non-SELECT queries", () => {
      const sql = "UPDATE pacientes SET nome = 'Test' WHERE id = 1";
      const result = AgentValidators.validateSQL(sql);
      expect(result.valid).toBe(false);
    });
  });

  describe("validateUserPermission", () => {
    it("should allow admin to do anything", () => {
      const result = AgentValidators.validateUserPermission("admin", "delete");
      expect(result.allowed).toBe(true);
    });

    it("should allow operador to read/write", () => {
      const result = AgentValidators.validateUserPermission("operador", "write");
      expect(result.allowed).toBe(true);
    });

    it("should not allow operador to delete", () => {
      const result = AgentValidators.validateUserPermission("operador", "delete");
      expect(result.allowed).toBe(false);
    });

    it("should only allow leitor to read", () => {
      const result = AgentValidators.validateUserPermission("leitor", "read");
      expect(result.allowed).toBe(true);
    });

    it("should not allow leitor to write", () => {
      const result = AgentValidators.validateUserPermission("leitor", "write");
      expect(result.allowed).toBe(false);
    });
  });
});
