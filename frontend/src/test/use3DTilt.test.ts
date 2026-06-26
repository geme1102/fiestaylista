import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { use3DTilt } from '../hooks/use3DTilt';

describe('use3DTilt', () => {
  it('returns ref and handlers', () => {
    const { result } = renderHook(() => use3DTilt());
    expect(result.current.ref).toBeDefined();
    expect(typeof result.current.handleMouseMove).toBe('function');
    expect(typeof result.current.handleMouseLeave).toBe('function');
  });

  it('sets transform on mousemove', () => {
    const { result } = renderHook(() => use3DTilt(10));
    const div = document.createElement('div');
    div.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 200, height: 100,
      right: 200, bottom: 100,
      x: 0, y: 0,
      toJSON: () => ({}),
    });
    (result.current.ref as React.MutableRefObject<HTMLDivElement | null>).current = div;

    const mouseEvent = { clientX: 100, clientY: 25 } as React.MouseEvent;
    act(() => { result.current.handleMouseMove(mouseEvent); });

    expect(div.style.transform).toContain('rotateX(');
    expect(div.style.transform).toContain('rotateY(');
    expect(div.style.transform).toContain('scale3d(1.02, 1.02, 1.02)');
  });

  it('resets transform on mouseleave', () => {
    const { result } = renderHook(() => use3DTilt());
    const div = document.createElement('div');
    div.style.transform = 'perspective(600px) rotateX(5deg) rotateY(5deg) scale3d(1.02, 1.02, 1.02)';
    (result.current.ref as React.MutableRefObject<HTMLDivElement | null>).current = div;

    act(() => { result.current.handleMouseLeave(); });

    expect(div.style.transform).toBe('perspective(600px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
  });

  it('does nothing when ref is null on mousemove', () => {
    const { result } = renderHook(() => use3DTilt());
    (result.current.ref as React.MutableRefObject<HTMLDivElement | null>).current = null;
    expect(() => {
      act(() => { result.current.handleMouseMove({ clientX: 100, clientY: 50 } as React.MouseEvent); });
    }).not.toThrow();
  });
});
