import { describe, expect, it } from "vitest";
import { checkGrammar, detectCorrectUsage, thirdPerson } from "./grammar-rules";

function fix(text: string) {
  return checkGrammar(text).map((h) => ({ id: h.ruleId, corrected: h.corrected }));
}

describe("checkGrammar — the learner's own example mistakes", () => {
  it("fixes present verb with a past time marker", () => {
    const hits = checkGrammar("I go yesterday");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      category: "past-tense",
      original: "I go yesterday",
      corrected: "I went yesterday",
    });
  });

  it("fixes 'since two years' with present continuous", () => {
    const [hit] = checkGrammar("I am working here since two years");
    expect(hit.category).toBe("present-perfect");
    expect(hit.corrected).toBe("I have been working here for two years");
  });

  it("removes 'about' after discuss", () => {
    const [hit] = checkGrammar("I discussed about the project");
    expect(hit.category).toBe("redundant-words");
    expect(hit.corrected).toBe("I discussed the project");
    expect(hit.alternative).toBe("I talked about the project");
  });
});

describe("checkGrammar — other common patterns", () => {
  it.each([
    ["Yesterday he goes to the office.", "Yesterday he went to the office."],
    ["Last weekend I go to Lonavala and it was fun.", "Last weekend I went to Lonavala and it was fun."],
    ["Yesterday, I go to the market.", "Yesterday, I went to the market."],
    ["Last year our server go down on a Friday night.", "Last year our server went down on a Friday night."],
    ["I didn't knew what to do.", "I didn't know what to do."],
    ["I usually go to the gym, but yesterday I go to the park.", "I usually go to the gym, but yesterday I went to the park."],
    ["Two years ago I join this company.", "Two years ago I joined this company."],
    ["I have completed my project last month.", "I completed my project last month."],
    ["I have joined this company in 2021.", "I joined this company in 2021."],
    ["I didn't went to college.", "I didn't go to college."],
    ["She doesn't knows the answer.", "She doesn't know the answer."],
    ["I am working here from 2021.", "I have been working here since 2021."],
    ["We are living here since 2019.", "We have been living here since 2019."],
    ["This laptop is more better.", "This laptop is better."],
    ["He gave me many informations.", "He gave me a lot of information."],
    ["My manager don't like delays.", "My manager doesn't like delays."],
    ["I think he have a car.", "I think he has a car."],
    ["I am having 2 years of experience in Java.", "I have 2 years of experience in Java."],
    ["I am not understanding this.", "I don't understand this."],
    ["Today morning I had tea.", "This morning I had tea."],
    ["Myself Deepak and I am from Delhi.", "I am Deepak and I am from Delhi."],
    ["Can you explain me the plan?", "Can you explain to me the plan?"],
    ["I can able to do it.", "I can do it."],
    ["I am agree with you.", "I agree with you."],
    ["What you are doing?", "What are you doing?"],
    ["I am software engineer.", "I am a software engineer."],
    ["I am working as engineer.", "I am working as an engineer."],
    ["I will revert back to you.", "I will get back to you."],
  ])("%s", (input, expected) => {
    expect(fix(input).map((f) => f.corrected)).toContain(expected);
  });

  it("does not flag correct sentences", () => {
    const correct = [
      "I went to the market yesterday.",
      "I have been working here for two years.",
      "We discussed the project.",
      "I want to tell you what I did yesterday.",
      "I usually go to the gym, but yesterday I was tired.",
      "Tomorrow I will go to Pune.",
      "Does he have a laptop?",
      "I am a software developer.",
      "I am working from home.",
      "We are having a meeting now.",
      "It's done.",
      "I like coding in my free time.",
      "I have experience in React.",
      "My name is Deepak.",
    ];
    for (const s of correct) expect(checkGrammar(s), s).toEqual([]);
  });

  it("checks each sentence separately and quotes it exactly", () => {
    const text = "I like my job. Yesterday I eat pizza. It was good.";
    const hits = checkGrammar(text);
    expect(hits).toHaveLength(1);
    expect(hits[0].original).toBe("Yesterday I eat pizza.");
    expect(hits[0].corrected).toBe("Yesterday I ate pizza.");
  });
});

describe("detectCorrectUsage", () => {
  it("finds correct past tense and present perfect", () => {
    const uses = detectCorrectUsage("Yesterday I went to Pune. I have been working here for two years.");
    expect(uses.map((u) => u.category)).toEqual(expect.arrayContaining(["past-tense", "present-perfect"]));
  });

  it("does not count a sentence that also contains the mistake", () => {
    const uses = detectCorrectUsage("I am working here since two years.");
    expect(uses.find((u) => u.category === "present-perfect")).toBeUndefined();
  });

  it("finds discuss without about", () => {
    expect(detectCorrectUsage("We discussed the timeline.")).toEqual([
      { category: "redundant-words", sentence: "We discussed the timeline." },
    ]);
  });
});

describe("thirdPerson", () => {
  it.each([
    ["go", "goes"], ["have", "has"], ["watch", "watches"], ["study", "studies"], ["play", "plays"], ["work", "works"],
  ])("%s → %s", (base, out) => expect(thirdPerson(base)).toBe(out));
});
