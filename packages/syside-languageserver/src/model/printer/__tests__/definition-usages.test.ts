/********************************************************************************
 * Copyright (c) 2022-2025 Sensmetry UAB and others
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License, v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import * as ast from "../../../generated/ast.js";
import { expectPrinted } from "./utils.js";

describe("definition-usage", () => {
    it("should print extended definitions", async () => {
        return expectPrinted("abstract #prefix def a :> b {}", {
            lang: "sysml",
            node: ast.Definition.$type,
        }).resolves.toEqual("abstract #prefix def a :> b {}\n");
    });

    it("should print extended variation definitions", async () => {
        return expectPrinted("variation #prefix def a :> b {}", {
            lang: "sysml",
            node: ast.Definition.$type,
        }).resolves.toEqual("variation #prefix def a :> b {}\n");
    });

    it("should print extended usages", async () => {
        return expectPrinted("inout abstract readonly derived #prefix a :> b {}", {
            lang: "sysml",
            node: ast.Usage.$type,
        }).resolves.toEqual("inout abstract readonly derived #prefix a :> b {}\n");
    });

    it("should print end usages", async () => {
        return expectPrinted("end #prefix a :> b;", {
            lang: "sysml",
            node: ast.Usage.$type,
        }).resolves.toEqual("end #prefix a :> b;\n");
    });

    it("should print end usages with cross features", async () => {
        return expectPrinted("end cross [10] #prefix a :> b;", {
            lang: "sysml",
            node: ast.Usage.$type,
        }).resolves.toEqual("end cross [10] #prefix a :> b;\n");
    });

    it("should print extended variation usages", async () => {
        return expectPrinted("variation #prefix a :> b {}", {
            lang: "sysml",
            node: ast.Usage.$type,
        }).resolves.toEqual("variation #prefix a :> b {}\n");
    });

    it("should print reference usages", async () => {
        return expectPrinted("variation ref a :> b {}", {
            lang: "sysml",
            node: ast.ReferenceUsage.$type,
        }).resolves.toEqual("variation ref a :> b {}\n");
    });

    it("should print variant reference usage shorthand", async () => {
        return expectPrinted("part { variant  b {}}", {
            lang: "sysml",
            node: ast.ReferenceUsage.$type,
        }).resolves.toEqual("b {}\n");
    });
});

describe("enum", () => {
    it("should print definitions", async () => {
        return expectPrinted("enum def E;", {
            lang: "sysml",
            node: ast.EnumerationDefinition.$type,
        }).resolves.toEqual("enum def E;\n");
    });

    it("should print usages", async () => {
        return expectPrinted("abstract enum E = 1;", {
            lang: "sysml",
            node: ast.EnumerationUsage.$type,
        }).resolves.toEqual("abstract enum E = 1;\n");
    });

    it("should print enum values", async () => {
        return expectPrinted("enum def E { enum value; }", {
            lang: "sysml",
            node: ast.EnumerationUsage.$type,
        }).resolves.toEqual("enum value;\n");
    });

    it("should preserve missing enum keyword", async () => {
        return expectPrinted("enum def E { = 1; }", {
            lang: "sysml",
            node: ast.EnumerationUsage.$type,
        }).resolves.toEqual("= 1;\n");
    });

    it("should remove enum keyword if option is set", async () => {
        return expectPrinted("enum def E { enum value; }", {
            lang: "sysml",
            node: ast.EnumerationUsage.$type,
            format: { enum_member_keyword: { default: "never" } },
        }).resolves.toEqual("value;\n");
    });
});

describe.each([
    ["attribute", ast.AttributeDefinition.$type, ast.AttributeUsage.$type],
    ["action", ast.ActionDefinition.$type, ast.ActionUsage.$type],
    ["metadata", ast.MetadataDefinition.$type, undefined],
    ["occurrence", ast.OccurrenceDefinition.$type, ast.OccurrenceUsage.$type],
    ["part", ast.PartDefinition.$type, ast.PartUsage.$type],
    ["item", ast.ItemDefinition.$type, ast.ItemUsage.$type],
    ["port", ast.PortDefinition.$type, ast.PortUsage.$type],
    ["action", ast.ActionDefinition.$type, undefined],
    ["allocation", ast.AllocationDefinition.$type, undefined],
    ["analysis", ast.AnalysisCaseDefinition.$type, ast.AnalysisCaseUsage.$type],
    ["calc", ast.CalculationDefinition.$type, ast.CalculationUsage.$type],
    ["case", ast.CaseDefinition.$type, ast.CaseUsage.$type],
    ["concern", ast.ConcernDefinition.$type, ast.ConcernUsage.$type],
    ["constraint", ast.ConstraintDefinition.$type, ast.ConstraintUsage.$type],
    ["rendering", ast.RenderingDefinition.$type, ast.RenderingUsage.$type],
    ["requirement", ast.RequirementDefinition.$type, ast.RequirementUsage.$type],
    ["state", ast.StateDefinition.$type, ast.StateUsage.$type],
    ["use case", ast.UseCaseDefinition.$type, ast.UseCaseUsage.$type],
    ["verification", ast.VerificationCaseDefinition.$type, ast.VerificationCaseUsage.$type],
    ["view", ast.ViewDefinition.$type, ast.ViewUsage.$type],
    ["viewpoint", ast.ViewpointDefinition.$type, ast.ViewpointUsage.$type],
    ["connection", ast.ConnectionDefinition.$type, undefined],
    ["interface", ast.InterfaceDefinition.$type, undefined],
    ["flow", ast.FlowConnectionDefinition.$type, undefined],
] as const)("%s", (kw, def, usage) => {
    it("should print definitions", async () => {
        return expectPrinted(`${kw} def E;`, {
            lang: "sysml",
            node: def,
        }).resolves.toEqual(`${kw} def E;\n`);
    });

    if (usage)
        it("should print usages", async () => {
            return expectPrinted(`abstract ref ${kw} E : c;`, {
                lang: "sysml",
                node: usage,
            }).resolves.toEqual(`abstract ref ${kw} E : c;\n`);
        });
});

describe("occurrences", () => {
    it.each(["timeslice", "snapshot"])("should print portion kind %s", async (kw) => {
        return expectPrinted(`abstract ${kw} occurrence E : c;`, {
            lang: "sysml",
            node: ast.OccurrenceUsage.$type,
        }).resolves.toEqual(`abstract ${kw} occurrence E : c;\n`);
    });
});

describe("states", () => {
    it("should print parallel keyword in definitions", async () => {
        return expectPrinted("state def S parallel {}", {
            lang: "sysml",
            node: ast.StateDefinition.$type,
        }).resolves.toEqual("state def S parallel {}\n");
    });

    it("should print parallel keyword in usages", async () => {
        return expectPrinted("state S parallel {}", {
            lang: "sysml",
            node: ast.StateUsage.$type,
        }).resolves.toEqual("state S parallel {}\n");
    });
});

describe("individual occurrence definitions", () => {
    it("should print definitions with keyword preserved", async () => {
        return expectPrinted("individual occurrence def E { }", {
            lang: "sysml",
            node: ast.OccurrenceDefinition.$type,
        }).resolves.toEqual("individual occurrence def E {}\n");
    });

    it("should print definitions with missing keyword preserved", async () => {
        return expectPrinted("individual def E { }", {
            lang: "sysml",
            node: ast.OccurrenceDefinition.$type,
        }).resolves.toEqual("individual def E {}\n");
    });

    it("should print definitions with added keyword", async () => {
        return expectPrinted("individual def E { }", {
            lang: "sysml",
            node: ast.OccurrenceDefinition.$type,
            format: {
                occurrence_keyword: { default: "always" },
            },
        }).resolves.toEqual("individual occurrence def E {}\n");
    });
});

describe.each(["individual", "snapshot", "timeslice"])("%s occurrences", (kw) => {
    it("should print usages with keyword preserved", async () => {
        return expectPrinted(`${kw} occurrence E { }`, {
            lang: "sysml",
            node: ast.OccurrenceUsage.$type,
        }).resolves.toEqual(`${kw} occurrence E {}\n`);
    });

    it("should print usages with missing keyword preserved", async () => {
        return expectPrinted(`${kw} E { }`, {
            lang: "sysml",
            node: ast.OccurrenceUsage.$type,
        }).resolves.toEqual(`${kw} E {}\n`);
    });

    it("should print usages with added keyword", async () => {
        return expectPrinted(`${kw} E { }`, {
            lang: "sysml",
            node: ast.OccurrenceUsage.$type,
            format: {
                occurrence_keyword: { default: "always" },
            },
        }).resolves.toEqual(`${kw} occurrence E {}\n`);
    });
});

describe.each([
    ["assert", "constraint", ast.AssertConstraintUsage.$type, "assert_constraint_usage_keyword"],
    ["event", "occurrence", ast.EventOccurrenceUsage.$type, "event_occurrence_keyword"],
    ["exhibit", "state", ast.ExhibitStateUsage.$type, "exhibit_state_usage_keyword"],
    ["include", "use case", ast.IncludeUseCaseUsage.$type, "include_use_case_usage_keyword"],
    ["perform", "action", ast.PerformActionUsage.$type, "perform_action_usage_keyword"],
    [
        "assert satisfy",
        "requirement",
        ast.SatisfyRequirementUsage.$type,
        "satisfy_requirement_keyword",
    ],
    [
        "assert not satisfy",
        "requirement",
        ast.SatisfyRequirementUsage.$type,
        "satisfy_requirement_keyword",
    ],
] as const)("%s %s", (id, kw, type, prop) => {
    it("should print with keyword preserved", async () => {
        return expectPrinted(`${id} ${kw} ::> E { }`, {
            lang: "sysml",
            node: type,
        }).resolves.toEqual(`${id} ${kw} ::> E {}\n`);
    });

    it("should print with missing keyword preserved", async () => {
        return expectPrinted(`${id} E { }`, {
            lang: "sysml",
            node: type,
        }).resolves.toEqual(`${id} E {}\n`);
    });

    it("should print with keyword when required", async () => {
        return expectPrinted(`${id} ${kw} E : e { }`, {
            lang: "sysml",
            node: type,
            format: { [prop]: { default: "as_needed" } },
        }).resolves.toEqual(`${id} ${kw} E : e {}\n`);
    });

    it("should not print with keyword when not required", async () => {
        return expectPrinted(`${id} ${kw} ::> e { }`, {
            lang: "sysml",
            node: type,
            format: { [prop]: { default: "as_needed" } },
        }).resolves.toEqual(`${id} e {}\n`);
    });

    it("should not print with keyword when node doesn't reference as the first specialization", async () => {
        return expectPrinted(`${id} ${kw} :>> e { }`, {
            lang: "sysml",
            node: type,
            format: { [prop]: { default: "as_needed" } },
        }).resolves.toEqual(`${id} ${kw} :>> e {}\n`);
    });
});

describe("satisfy requirement", () => {
    it("should print value and by", async () => {
        return expectPrinted("assert satisfy E = 1 by x.x {}", {
            lang: "sysml",
            node: ast.SatisfyRequirementUsage.$type,
        }).resolves.toEqual("assert satisfy E = 1 by x.x {}\n");
    });

    it("should break long declarations", async () => {
        return expectPrinted(
            `
            assert satisfy some_long_identifier_here
            = some_long_lhs_expression_value > some_long_rhs_value
            by some_long_by_name {}`,
            {
                lang: "sysml",
                node: ast.SatisfyRequirementUsage.$type,
                options: { lineWidth: 40 },
            }
        ).resolves.toMatchInlineSnapshot(`
"assert satisfy
    some_long_identifier_here =
        some_long_lhs_expression_value >
        some_long_rhs_value
    by some_long_by_name {}
"
`);
    });

    it("should preserve missing assert", async () => {
        return expectPrinted("satisfy E = 1 by x {}", {
            lang: "sysml",
            node: ast.SatisfyRequirementUsage.$type,
        }).resolves.toEqual("satisfy E = 1 by x {}\n");
    });
});

describe("exhibit state", () => {
    it("should print parallel states", async () => {
        return expectPrinted("exhibit E = 1 parallel {}", {
            lang: "sysml",
            node: ast.ExhibitStateUsage.$type,
            format: {
                empty_namespace_brackets: {
                    default: "never",
                },
            },
        }).resolves.toEqual("exhibit E = 1 parallel {}\n");
    });
});

describe("interfaces", () => {
    it("should print default interface ends", async () => {
        return expectPrinted("interface def I { end End; }", {
            lang: "sysml",
            node: ast.PortUsage.$type,
        }).resolves.toEqual("end End;\n");
    });

    it("should print explicit port usage ends", async () => {
        return expectPrinted("interface def I { end [1] port End; }", {
            lang: "sysml",
            node: ast.PortUsage.$type,
        }).resolves.toEqual("end [1] port End;\n");
    });
});
