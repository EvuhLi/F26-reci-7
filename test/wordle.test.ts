import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { matchGuess } from "../src/wordle";

// Recitation Part 1: follow along with your TA, filling in the todos below.
// Problem set Task 1: keep adding properties until `npm run mutants:wordle`
// kills every mutant. Read the spec in src/wordle/matchGuess.ts.
//
// Label every property with its pattern, on the line above its `it(`:
//   // Pattern: invariant. The result always has exactly five colors.
// (invariant, algebraic, metamorphic, differential, or conditional)

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const wordFrom = (letters: string) =>
  fc
    .array(fc.constantFrom(...letters), { minLength: 5, maxLength: 5 })
    .map((cs) => cs.join(""));

// A small alphabet makes repeated letters (and so yellow/black bookkeeping)
// common. The full alphabet is needed too, or letters D-Z are never tested.
const word = fc.oneof(wordFrom("ABC"), wordFrom(ALPHABET));

// A random secret plus a random three-letter alphabet drawn from all of A-Z,
// so pairs share letters often but every letter still shows up.
const wordPair = fc
  .shuffledSubarray([...ALPHABET], { minLength: 3, maxLength: 3 })
  .chain((letters) => fc.tuple(wordFrom(letters.join("")), wordFrom(letters.join(""))));
const pair = fc.oneof(fc.tuple(word, word), wordPair);

const count = (w: string, letter: string) =>
  [...w].filter((c) => c === letter).length;

describe("matchGuess", () => {
  // Pattern: invariant. The result always has exactly five colors.
  it("returns exactly five colors", () => {
    fc.assert(
      fc.property(pair, ([secret, guess]) => {
        expect(matchGuess(secret, guess)).toHaveLength(5);
      }),
    );
  });

  // Pattern: invariant. Every color is one of G, Y, B.
  it("only uses colors G, Y, B", () => {
    fc.assert(
      fc.property(pair, ([secret, guess]) => {
        for (const c of matchGuess(secret, guess))
          expect(["G", "Y", "B"]).toContain(c);
      }),
    );
  });

  // Pattern: conditional. If the guess is the secret, every position is green.
  it("guessing the secret gives all greens", () => {
    fc.assert(
      fc.property(word, (w) => {
        expect(matchGuess(w, w)).toEqual(["G", "G", "G", "G", "G"]);
      }),
    );
  });

  // Pattern: invariant. Position i is green exactly when guess[i] === secret[i].
  it("is green exactly where the letters match", () => {
    fc.assert(
      fc.property(pair, ([secret, guess]) => {
        const result = matchGuess(secret, guess);
        for (let i = 0; i < 5; i++)
          expect(result[i] === "G").toBe(guess[i] === secret[i]);
      }),
    );
  });

  // Pattern: invariant. A letter is never credited (G or Y) more often than the secret contains it.
  it("never credits a letter more times than the secret contains it", () => {
    fc.assert(
      fc.property(pair, ([secret, guess]) => {
        const result = matchGuess(secret, guess);
        for (const letter of new Set(guess)) {
          const credited = [...guess].filter(
            (c, i) => c === letter && result[i] !== "B",
          ).length;
          expect(credited).toBeLessThanOrEqual(count(secret, letter));
        }
      }),
    );
  });

  // Pattern: invariant. Each letter is credited exactly min(#guess, #secret) times: unused occurrences are never left black.
  it("credits each letter as often as both words allow", () => {
    fc.assert(
      fc.property(pair, ([secret, guess]) => {
        const result = matchGuess(secret, guess);
        for (const letter of new Set(guess)) {
          const credited = [...guess].filter(
            (c, i) => c === letter && result[i] !== "B",
          ).length;
          expect(credited).toBe(
            Math.min(count(guess, letter), count(secret, letter)),
          );
        }
      }),
    );
  });

  // Pattern: invariant. Yellows are assigned left to right: for each letter, no non-green yellow comes after a black.
  it("assigns yellows left to right", () => {
    fc.assert(
      fc.property(pair, ([secret, guess]) => {
        const result = matchGuess(secret, guess);
        for (const letter of new Set(guess)) {
          const nonGreen = [...guess]
            .map((c, i) => (c === letter && result[i] !== "G" ? result[i] : null))
            .filter((c) => c !== null)
            .join("");
          expect(nonGreen).toMatch(/^Y*B*$/);
        }
      }),
    );
  });

  // Pattern: metamorphic. Renaming letters with a one-to-one mapping in both words does not change the result.
  it("does not depend on which letters are used", () => {
    const renaming = fc.shuffledSubarray([...ALPHABET], {
      minLength: 26,
      maxLength: 26,
    });
    fc.assert(
      fc.property(pair, renaming, ([secret, guess], perm) => {
        const rename = (w: string) =>
          [...w].map((c) => perm[ALPHABET.indexOf(c)]).join("");
        expect(matchGuess(rename(secret), rename(guess))).toEqual(
          matchGuess(secret, guess),
        );
      }),
    );
  });

  // Pattern: conditional. If the guess is a rearrangement of the secret, no position is black.
  // Targeted generator: the guess is built by shuffling the secret's letters.
  it("a rearrangement of the secret has no blacks", () => {
    const anagramPair = word.chain((secret) =>
      fc
        .shuffledSubarray([...secret], { minLength: 5, maxLength: 5 })
        .map((cs) => [secret, cs.join("")] as const),
    );
    fc.assert(
      fc.property(anagramPair, ([secret, guess]) => {
        expect(matchGuess(secret, guess)).not.toContain("B");
      }),
    );
  });

  // Pattern: conditional. If the guess shares no letters with the secret, every position is black.
  // Targeted generator: the alphabet is split in two and each word draws from one half.
  it("a guess with no letters in common is all black", () => {
    const disjointPair = fc
      .shuffledSubarray([...ALPHABET], { minLength: 26, maxLength: 26 })
      .chain((letters) => {
        const cut = 1 + (letters.length >> 1);
        return fc.tuple(
          wordFrom(letters.slice(0, cut).join("")),
          wordFrom(letters.slice(cut).join("")),
        );
      });
    fc.assert(
      fc.property(disjointPair, ([secret, guess]) => {
        expect(matchGuess(secret, guess)).toEqual(["B", "B", "B", "B", "B"]);
      }),
    );
  });

  // Pattern: invariant. Anything other than five uppercase letters A-Z throws a RangeError.
  it("rejects malformed words", () => {
    const bad = fc.oneof(
      fc.string({ maxLength: 8 }).filter((s) => !/^[A-Z]{5}$/.test(s)),
      word.map((w) => w.toLowerCase()),
      word.map((w) => w.slice(0, 4)),
      word.map((w) => w + "A"),
    );
    fc.assert(
      fc.property(word, bad, (good, b) => {
        expect(() => matchGuess(good, b)).toThrow(RangeError);
        expect(() => matchGuess(b, good)).toThrow(RangeError);
      }),
    );
  });

  it("matches the spec example", () => {
    expect(matchGuess("APPLE", "ALLEY")).toEqual(["G", "Y", "B", "Y", "B"]);
  });
});
