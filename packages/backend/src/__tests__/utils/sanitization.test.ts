import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  stripHtmlTags,
  sanitizeString,
  sanitizeForErrorMessage,
  containsSuspiciousContent,
  sanitizeObject,
} from '../../utils/sanitization.js';

describe('Sanitization Utilities', () => {
  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
      );
    });

    it('should escape ampersands', () => {
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('should escape quotes', () => {
      expect(escapeHtml('Say "hello"')).toBe('Say &quot;hello&quot;');
      expect(escapeHtml("It's fine")).toBe('It&#x27;s fine');
    });

    it('should escape backticks', () => {
      expect(escapeHtml('Use `code`')).toBe('Use &#x60;code&#x60;');
    });

    it('should escape equals signs', () => {
      expect(escapeHtml('a=b')).toBe('a&#x3D;b');
    });

    it('should handle empty string', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(escapeHtml(null as unknown as string)).toBe(null);
      expect(escapeHtml(undefined as unknown as string)).toBe(undefined);
    });

    it('should handle strings without special characters', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
    });
  });

  describe('stripHtmlTags', () => {
    it('should remove HTML tags', () => {
      expect(stripHtmlTags('<p>Hello</p>')).toBe('Hello');
      expect(stripHtmlTags('<b>Bold</b> and <i>italic</i>')).toBe('Bold and italic');
    });

    it('should remove script tags', () => {
      expect(stripHtmlTags('<script>alert("xss")</script>')).toBe('alert("xss")');
    });

    it('should remove self-closing tags', () => {
      expect(stripHtmlTags('Line 1<br/>Line 2')).toBe('Line 1Line 2');
    });

    it('should handle malformed tags', () => {
      expect(stripHtmlTags('<div>Unclosed')).toBe('Unclosed');
      expect(stripHtmlTags('text<>more')).toBe('textmore');
    });

    it('should handle empty string', () => {
      expect(stripHtmlTags('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(stripHtmlTags(null as unknown as string)).toBe(null);
      expect(stripHtmlTags(undefined as unknown as string)).toBe(undefined);
    });
  });

  describe('sanitizeString', () => {
    it('should strip HTML and normalize whitespace', () => {
      expect(sanitizeString('  <b>Hello</b>  World  ')).toBe('Hello World');
    });

    it('should trim leading and trailing whitespace', () => {
      expect(sanitizeString('   text   ')).toBe('text');
    });

    it('should collapse multiple spaces', () => {
      expect(sanitizeString('word1    word2')).toBe('word1 word2');
    });

    it('should handle newlines and tabs', () => {
      expect(sanitizeString('line1\n\nline2\ttab')).toBe('line1 line2 tab');
    });

    it('should handle empty string', () => {
      expect(sanitizeString('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(sanitizeString(null as unknown as string)).toBe(null);
      expect(sanitizeString(undefined as unknown as string)).toBe(undefined);
    });
  });

  describe('sanitizeForErrorMessage', () => {
    it('should escape HTML in error messages', () => {
      expect(sanitizeForErrorMessage('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
      );
    });

    it('should truncate long strings', () => {
      const longString = 'a'.repeat(150);
      const result = sanitizeForErrorMessage(longString, 100);
      expect(result).toBe('a'.repeat(100) + '...');
    });

    it('should not truncate short strings', () => {
      expect(sanitizeForErrorMessage('short', 100)).toBe('short');
    });

    it('should handle empty string', () => {
      expect(sanitizeForErrorMessage('')).toBe('');
    });

    it('should convert non-strings', () => {
      expect(sanitizeForErrorMessage(123 as unknown as string)).toBe('123');
      expect(sanitizeForErrorMessage(null as unknown as string)).toBe('null');
    });
  });

  describe('containsSuspiciousContent', () => {
    describe('XSS attack patterns', () => {
      it('should detect script tags', () => {
        expect(containsSuspiciousContent('<script>alert(1)</script>')).toBe(true);
        expect(containsSuspiciousContent('<SCRIPT>alert(1)</SCRIPT>')).toBe(true);
        expect(containsSuspiciousContent('<ScRiPt>alert(1)</ScRiPt>')).toBe(true);
      });

      it('should detect javascript: protocol', () => {
        expect(containsSuspiciousContent('javascript:alert(1)')).toBe(true);
        expect(containsSuspiciousContent('JAVASCRIPT:alert(1)')).toBe(true);
      });

      it('should detect event handlers', () => {
        expect(containsSuspiciousContent('<img onerror=alert(1)>')).toBe(true);
        expect(containsSuspiciousContent('<div onclick=alert(1)>')).toBe(true);
        expect(containsSuspiciousContent('<body onload=alert(1)>')).toBe(true);
        expect(containsSuspiciousContent("onmouseover='alert(1)'")).toBe(true);
      });

      it('should detect data: protocol', () => {
        expect(containsSuspiciousContent('data:text/html,<script>alert(1)</script>')).toBe(true);
      });

      it('should detect vbscript: protocol', () => {
        expect(containsSuspiciousContent('vbscript:msgbox(1)')).toBe(true);
      });

      it('should detect iframe tags', () => {
        expect(containsSuspiciousContent('<iframe src="evil.html"></iframe>')).toBe(true);
      });

      it('should detect embed tags', () => {
        expect(containsSuspiciousContent('<embed src="evil.swf">')).toBe(true);
      });

      it('should detect object tags', () => {
        expect(containsSuspiciousContent('<object data="evil.swf"></object>')).toBe(true);
      });

      it('should detect SVG onload', () => {
        expect(containsSuspiciousContent('<svg onload=alert(1)>')).toBe(true);
      });

      it('should detect CSS expression', () => {
        expect(containsSuspiciousContent('background: expression(alert(1))')).toBe(true);
      });
    });

    describe('safe content', () => {
      it('should allow normal text', () => {
        expect(containsSuspiciousContent('Hello World')).toBe(false);
      });

      it('should allow email addresses', () => {
        expect(containsSuspiciousContent('user@example.com')).toBe(false);
      });

      it('should allow numbers', () => {
        expect(containsSuspiciousContent('12345')).toBe(false);
      });

      it('should allow special characters in context', () => {
        expect(containsSuspiciousContent("Tom & Jerry's Adventure")).toBe(false);
      });

      it('should handle empty string', () => {
        expect(containsSuspiciousContent('')).toBe(false);
      });

      it('should handle null/undefined', () => {
        expect(containsSuspiciousContent(null as unknown as string)).toBe(false);
        expect(containsSuspiciousContent(undefined as unknown as string)).toBe(false);
      });
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize string properties', () => {
      const input = {
        name: '  <b>John</b>  ',
        email: 'john@example.com',
      };
      const result = sanitizeObject(input);
      expect(result.name).toBe('John');
      expect(result.email).toBe('john@example.com');
    });

    it('should sanitize nested objects', () => {
      const input = {
        user: {
          name: '  <script>xss</script>  ',
        },
      };
      const result = sanitizeObject(input);
      expect(result.user.name).toBe('xss');
    });

    it('should sanitize arrays of strings', () => {
      const input = {
        tags: ['  <b>tag1</b>  ', '  tag2  '],
      };
      const result = sanitizeObject(input);
      expect(result.tags).toEqual(['tag1', 'tag2']);
    });

    it('should sanitize arrays of objects', () => {
      const input = {
        items: [{ name: '  <i>Item 1</i>  ' }, { name: '  Item 2  ' }],
      };
      const result = sanitizeObject(input);
      expect(result.items[0].name).toBe('Item 1');
      expect(result.items[1].name).toBe('Item 2');
    });

    it('should preserve non-string values', () => {
      const input = {
        count: 42,
        active: true,
        data: null,
      };
      const result = sanitizeObject(input);
      expect(result.count).toBe(42);
      expect(result.active).toBe(true);
      expect(result.data).toBe(null);
    });

    it('should not mutate original object', () => {
      const input = {
        name: '  <b>John</b>  ',
      };
      const result = sanitizeObject(input);
      expect(input.name).toBe('  <b>John</b>  ');
      expect(result.name).toBe('John');
    });

    it('should handle empty object', () => {
      const result = sanitizeObject({});
      expect(result).toEqual({});
    });

    it('should handle null/undefined', () => {
      expect(sanitizeObject(null as unknown as Record<string, unknown>)).toBe(null);
      expect(sanitizeObject(undefined as unknown as Record<string, unknown>)).toBe(undefined);
    });
  });

  describe('Real-world XSS attack examples', () => {
    describe('HTML tag-based attacks (stripped by sanitizeString)', () => {
      const tagBasedAttacks = [
        // Employee name injection
        {
          input: 'John<script>alert(document.cookie)</script>',
          field: 'name',
          expectedSanitized: 'Johnalert(document.cookie)',
        },
        // Notes injection
        { input: '"><img src=x onerror=alert(1)>', field: 'notes', expectedSanitized: '">' },
        // SVG-based attack
        {
          input: '<svg><animate onbegin=alert(1) attributeName=x dur=1s>',
          field: 'notes',
          expectedSanitized: '',
        },
        // Script tag with escaped character
        { input: '<script>alert(1)</script>', field: 'comment', expectedSanitized: 'alert(1)' },
      ];

      tagBasedAttacks.forEach(({ input, field, expectedSanitized }) => {
        it(`should sanitize ${field} field: ${input.substring(0, 30)}...`, () => {
          const sanitized = sanitizeString(input);
          // Ensure no raw HTML tags remain
          expect(sanitized).not.toMatch(/<[^>]*>/);
          expect(sanitized).toBe(expectedSanitized);
        });
      });
    });

    describe('Non-tag attacks (detected by containsSuspiciousContent)', () => {
      // These attacks don't use HTML tags but contain suspicious patterns.
      // sanitizeString won't remove them, but containsSuspiciousContent detects them.
      // React's escaping protects against these when rendered.
      const patternAttacks = [
        { input: '" onmouseover="alert(1)"', pattern: 'event handler' },
        { input: 'javascript:alert(1)', pattern: 'javascript protocol' },
        { input: 'data:text/html,attack', pattern: 'data protocol' },
      ];

      patternAttacks.forEach(({ input, pattern }) => {
        it(`should detect ${pattern} in: ${input}`, () => {
          // These should be detected as suspicious
          expect(containsSuspiciousContent(input)).toBe(true);
          // But sanitizeString doesn't modify them (no HTML tags to strip)
          const sanitized = sanitizeString(input);
          // Detection still works on sanitized content
          expect(containsSuspiciousContent(sanitized)).toBe(true);
        });
      });
    });

    describe('Combined approach for maximum safety', () => {
      it('should sanitize AND escape for error messages', () => {
        const attack = '<script>alert("xss")</script>';
        const forError = sanitizeForErrorMessage(attack);
        // HTML entities escaped
        expect(forError).toContain('&lt;script&gt;');
        // Original attack payload neutralized
        expect(forError).not.toContain('<script>');
      });
    });
  });
});
