import { inject, LanguageMetaData, Module } from "langium";
import { createDefaultModule } from "langium/lsp";
import {
    KerMLGeneratedModule,
    KerMLLanguageMetaData,
    SysMLGeneratedModule,
    SysMLLanguageMetaData,
} from "#generated/module.js";
import { KerMLModule, SysMLDefaultModule, SysMLModule } from "../../../sysml-module.js";
import { services } from "../../../testing/index.js";
import { SysMLDefaultServices } from "../../services.js";

// The generated modules run in production mode, which skips Chevrotain's grammar validation at startup.
function developmentMode(metaData: LanguageMetaData): Module<SysMLDefaultServices, object> {
    return {
        LanguageMetaData: (): LanguageMetaData => {
            return { ...metaData, mode: "development" };
        },
    };
}

describe("grammar", () => {
    test("SysML passes Chevrotain validation", () => {
        const language = inject(
            createDefaultModule({ shared: services.shared }),
            SysMLGeneratedModule,
            SysMLDefaultModule,
            SysMLModule,
            developmentMode(SysMLLanguageMetaData)
        );
        expect(() => language.parser.LangiumParser).not.toThrow();
    });

    test("KerML passes Chevrotain validation", () => {
        const language = inject(
            createDefaultModule({ shared: services.shared }),
            KerMLGeneratedModule,
            SysMLDefaultModule,
            KerMLModule,
            developmentMode(KerMLLanguageMetaData)
        );
        expect(() => language.parser.LangiumParser).not.toThrow();
    });
});
