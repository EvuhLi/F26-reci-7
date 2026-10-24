# Reflection

**Name / Andrew ID:**
Eva Li, evali

**Recitation group members (Task 2):**
Mira, Alex, Pritish
---

### 1. Valid but weak

Pick a property you wrote that passes on the correct implementation but
kills few or no mutants. Why is it still a *valid* property? Describe a
concrete bug (not one of our mutants) that it *would* catch.

"Returns exactly five colors" (Wordle, invariant) doens't kill any mutants, since every mutant would return an array of five colors still. However, it's still a valid implementation since the function should return five colors. A bug it would catch is if the result only had 4 colors, or was cut short. 

### 2. A generator problem, not a property problem

Describe a mutant, from either task, that survived or was flaky because of
your **generator** rather than your property. What did the generator fail to
produce? How did you fix it? Paste the runner output from before and after.

`singlePass` was flaky because of the generator. The property, "never credits
a letter more times than the secret contains it", stayed the same in both
runs. With random words over all of A–Z, the bug only shows when the guess
repeats a letter more often than the secret has it, and two random 26-letter
words almost never do that. So the property only sometimes saw a failing
input. Switching to a three-letter alphabet (`ABC`) makes repeated letters
the norm, and the same property kills it in every run.

Small alphabets have their own blind spot, though: they never test the
letters D–Z. My final generator mixes `ABC` words with full-alphabet words.
It also picks three random letters out of A–Z for both words, so repeats stay
common while every letter can show up.

Before (`const word = wordFrom(ALPHABET)`):
```
  ~ singlePass     flaky: killed in 3/5 runs  by: never credits a letter more times than the secret contains it
      Counterexample: ["AAAFA","AAFFA"]
      AssertionError: expected 2 to be less than or equal to 1
```
After (`const word = wordFrom('ABC')`, same property):
```
  ✔ singlePass     killed  by: never credits a letter more times than the secret contains it
      Counterexample: ["AAABA","AAAAA"]
      AssertionError: expected 5 to be less than or equal to 4
```

### 3. Reading a counterexample

Paste one counterexample that the mutation runner printed for a killed
mutant. In 2–3 sentences, explain using the *specification* why that input
exposes the bug.

  ✔ mergesIntegerNeighbors  killed  by: covers exactly the same points as the input; ...
      Counterexample: [[[2,2],[3,3]]]
      AssertionError: expected [ 2.5, true ] to deeply equal [ 2.5, false ]
The specification states that the result should cover exactly the same points as the input, and that they are reals. The mutant merged the two into a single interval, which covered the number 2.5, even though it wasn't in the input interval. Therefore, my property ensures that reals in between intervals don't get merged. 

### 4. Your project

Name one function or module in your team's project that would benefit from
property-based testing. State two properties in English, name the pattern of
each, and describe the generator you'd need, including anything about its
inputs that a naive generator would get wrong.

The feature that output chats as JSON files would benefit from property-based testing. For example, one property culd be that the JSON stores all the messages inthe chat, and the other property could be that they are stored in the correct order. The first property is an invariant, and the second property is metamorphic. The generaor would need to input in the list of messages in the correct order. A naive generator would not check that all messages are included, or that they are it he rigt order. 