"use client";

import { useState } from "react";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Topbar() {
    const [lang, setLang] = useState("ES");

    return (
        <header className="h-16 border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-30 flex items-center justify-end px-6 gap-3">
            {/* Language Toggle Stub */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-9 gap-2 font-medium">
                        <Languages className="w-4 h-4 text-muted-foreground" />
                        <span className="hidden sm:inline-block">{lang === "ES" ? "Español" : "English"}</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setLang("ES")}>Español (ES)</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLang("EN")}>English (EN)</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Dark Mode Toggle */}
            <ModeToggle />
        </header>
    );
}
