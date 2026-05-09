import { describe, expect, it } from 'vitest';
import {
  AGENT_TOOL_DESCRIPTORS,
  ALLOWED_AGENT_TOOLS,
  toAnthropicTools,
  toGeminiTools,
  toOpenAITools
} from './tool-schemas';

describe('tool-schemas', () => {
  it('exposes a non-empty descriptor list whose names match the allowed set', () => {
    expect(AGENT_TOOL_DESCRIPTORS.length).toBeGreaterThan(0);
    const names = AGENT_TOOL_DESCRIPTORS.map((descriptor) => descriptor.name);
    expect(new Set(names)).toEqual(ALLOWED_AGENT_TOOLS);
  });

  it('every descriptor declares an object schema with a description', () => {
    for (const descriptor of AGENT_TOOL_DESCRIPTORS) {
      expect(descriptor.schema.type).toBe('object');
      expect(typeof descriptor.description).toBe('string');
      expect(descriptor.description.length).toBeGreaterThan(0);
    }
  });

  it('toOpenAITools wraps every descriptor as a function tool', () => {
    const tools = toOpenAITools();
    expect(tools).toHaveLength(AGENT_TOOL_DESCRIPTORS.length);
    expect(tools.every((tool) => tool.type === 'function')).toBe(true);
    expect(
      tools.every((tool) => typeof tool.function.name === 'string' && tool.function.name.length > 0)
    ).toBe(true);
  });

  it('toAnthropicTools shapes every descriptor for the messages tool field', () => {
    const tools = toAnthropicTools();
    expect(tools).toHaveLength(AGENT_TOOL_DESCRIPTORS.length);
    expect(tools.every((tool) => tool.input_schema.type === 'object')).toBe(true);
  });

  it('toGeminiTools returns one functionDeclarations entry covering every tool', () => {
    const groups = toGeminiTools();
    expect(groups).toHaveLength(1);
    expect(groups[0].functionDeclarations).toHaveLength(AGENT_TOOL_DESCRIPTORS.length);
  });
});
