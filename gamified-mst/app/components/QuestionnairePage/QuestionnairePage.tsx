"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { getClientConfig, Question } from "@/app/lib/clientConfig";

const config = getClientConfig();

const TEST_VERSION = new Map([
    ["omst", "OMST"],
    ["icon", "ICON"],
    ["gamified-mst", "Gamified MST"],
]);

function interpolateLabel(label: string, testVersion: string): string {
    return label.replace(/\{\{testVersion\}\}/g, testVersion);
}

function toggleMultiSelect(current: string[], option: string, noneOption?: string): string[] {
    const isSelected = current.includes(option);
    if (noneOption && option === noneOption) {
        return isSelected ? [] : [noneOption];
    }
    const withoutNone = noneOption
        ? current.filter((item) => item !== noneOption)
        : current;
    return isSelected
        ? withoutNone.filter((item) => item !== option)
        : [...withoutNone, option];
}

function isWholeNumberInRange(value: string, min: number, max: number) {
    if (value.trim() === "") return false;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= min && parsed <= max;
}

function isAnswerValid(question: Question, answer: string | string[]): boolean {
    if (!question.required) return true;
    switch (question.type) {
        case "rating":
            return isWholeNumberInRange(
                answer as string,
                question.min ?? 0,
                question.max ?? 10,
            );
        case "single-select":
            return Boolean(answer);
        case "multi-select":
            return Array.isArray(answer) && answer.length > 0;
        default:
            return false;
    }
}

export default function QuestionnairePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [testVersion, setTestVersion] = useState("");
    const testVersionTitle = TEST_VERSION.get(testVersion) || "";

    const [prolificPID, setProlificPID] = useState("");
    const [sessionID, setSessionID] = useState("");
    const [studyID, setStudyID] = useState("");

    // Dynamic answers state: keyed by question id
    const [answers, setAnswers] = useState<Record<string, string | string[]>>(() => {
        const initial: Record<string, string | string[]> = {};
        for (const q of config.questions) {
            initial[q.id] = q.type === "multi-select" ? [] : "";
        }
        return initial;
    });

    const canContinue = config.questions.every((q) =>
        isAnswerValid(q, answers[q.id]),
    );

    useEffect(() => {
        setTestVersion(searchParams.get("route") || "");
        setProlificPID(searchParams.get("PROLIFIC_PID") || "");
        setSessionID(searchParams.get("SESSION_ID") || "");
        setStudyID(searchParams.get("STUDY_ID") || "");
    }, []);

    const setAnswer = (id: string, value: string | string[]) => {
        setAnswers((prev) => ({ ...prev, [id]: value }));
    };

    const saveSurveyData = async () => {
        const AWS_API_GATEWAY = process.env.NEXT_PUBLIC_AWS_METRICS_API;

        if (!AWS_API_GATEWAY) {
            console.error("AWS API Gateway URL not configured");
            return;
        }

        try {
            const payload: Record<string, unknown> = {
                user_id: prolificPID,
                session_id: sessionID,
                study_id: studyID,
                session_completed: true,
                client_id: config.clientName,
            };

            // Add all answers to payload
            for (const q of config.questions) {
                payload[q.id] = answers[q.id];
            }

            console.log("Sending questionnaire metrics payload:", payload);

            const response = await fetch(`${AWS_API_GATEWAY}/metrics`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(
                    `Questionnaire metrics save failed: ${response.status}`,
                );
            }

            console.log("Questionnaire metrics saved successfully!");
        } catch (e) {
            console.error("Failed to save survey data:", e);
        }
    };

    const handleContinue = async () => {
        if (!canContinue) return;

        if (!prolificPID || !sessionID) {
            alert(
                "Missing required Prolific parameters (PROLIFIC_PID and SESSION_ID)",
            );
            return;
        }

        await saveSurveyData();

        const prolificComplete =
            process.env.NEXT_PUBLIC_PROLIFIC_COMPLETE_STUDY ||
            "https://app.prolific.com/submissions/complete";
        window.location.href = prolificComplete;
    };

    // Allow Enter key to continue when all required fields are filled
    const onEnterPress = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === "Enter" && canContinue) {
                handleContinue();
            }
        },
        [canContinue, handleContinue],
    );

    useEffect(() => {
        window.addEventListener("keydown", onEnterPress);
        return () => window.removeEventListener("keydown", onEnterPress);
    }, [onEnterPress]);

    const labelStyle = {
        display: "block",
        marginBottom: "8px",
        fontWeight: "700",
        fontSize: "18px",
    };
    const containerStyle = {
        marginLeft: "20px",
        marginBottom: "15px",
        textAlign: "left" as const,
    };
    const optionLabelStyle = {
        marginLeft: "10px",
        fontSize: "16px",
        fontWeight: "400",
    };

    const renderQuestion = (question: Question) => {
        const label = interpolateLabel(question.label, testVersionTitle);
        const answer = answers[question.id];

        switch (question.type) {
            case "rating": {
                const value = answer as string;
                const valid = isWholeNumberInRange(
                    value,
                    question.min ?? 0,
                    question.max ?? 10,
                );
                return (
                    <div key={question.id} style={containerStyle}>
                        <label style={labelStyle}>{label}</label>
                        <input
                            type="number"
                            min={question.min}
                            max={question.max}
                            value={value}
                            onChange={(e) =>
                                setAnswer(question.id, e.target.value)
                            }
                            placeholder={question.placeholder}
                            style={{
                                width: "100%",
                                padding: "12px",
                                borderRadius: "4px",
                                border: "1px solid #ccc",
                                fontSize: "16px",
                            }}
                        />
                        {!valid && value !== "" && (
                            <div style={{ color: "#b00", marginTop: 8 }}>
                                Enter a whole number from {question.min} to{" "}
                                {question.max}.
                            </div>
                        )}
                    </div>
                );
            }

            case "single-select":
                return (
                    <div key={question.id} style={containerStyle}>
                        <label style={labelStyle}>{label}</label>
                        {question.options?.map((option) => (
                            <label
                                key={option}
                                style={{ display: "block", cursor: "pointer" }}
                            >
                                <input
                                    type="radio"
                                    name={question.id}
                                    value={option}
                                    checked={answer === option}
                                    onChange={(e) =>
                                        setAnswer(question.id, e.target.value)
                                    }
                                />
                                <span style={optionLabelStyle}>{option}</span>
                            </label>
                        ))}
                    </div>
                );

            case "multi-select": {
                const selected = answer as string[];
                return (
                    <div key={question.id} style={containerStyle}>
                        <label style={labelStyle}>{label}</label>
                        {question.options?.map((option) => (
                            <label
                                key={option}
                                style={{ display: "block", cursor: "pointer" }}
                            >
                                <input
                                    type="checkbox"
                                    name={question.id}
                                    value={option}
                                    checked={selected.includes(option)}
                                    onChange={() =>
                                        setAnswer(
                                            question.id,
                                            toggleMultiSelect(
                                                selected,
                                                option,
                                                question.noneOption,
                                            ),
                                        )
                                    }
                                />
                                <span style={optionLabelStyle}>{option}</span>
                            </label>
                        ))}
                    </div>
                );
            }
        }
    };

    // Build validation summary
    const missingFields = config.questions
        .filter((q) => q.required && !isAnswerValid(q, answers[q.id]))
        .map((q) => {
            if (q.type === "rating")
                return `${q.id} rating (${q.min}–${q.max}) required`;
            return `${q.id} required`;
        });

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                minHeight: "100vh",
                width: "100%",
                fontFamily: "'Open Sans', sans-serif",
                backgroundColor: "#fff",
                color: "#333",
            }}
        >
            <div
                style={{
                    flex: 1,
                    margin: "20px auto",
                    padding: "20px 20px 140px",
                    maxWidth: "720px",
                    width: "95%",
                    overflowY: "auto",
                    WebkitOverflowScrolling: "touch",
                    boxSizing: "border-box",
                    maxHeight: "calc(100vh - 80px)",
                }}
            >
                <div style={{ textAlign: "center", marginBottom: "18px" }}>
                    <h1 style={{ fontSize: "28px", margin: 0 }}>
                        Post Study Questionnaire
                    </h1>
                </div>

                {config.questions.map(renderQuestion)}

                {/* Fixed footer button */}
                <div
                    style={{
                        position: "fixed",
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "#fff",
                        borderTop: "1px solid #eee",
                        padding: "12px 16px",
                        display: "flex",
                        justifyContent: "center",
                        zIndex: 9999,
                    }}
                >
                    <div
                        style={{
                            width: "100%",
                            maxWidth: 720,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <div style={{ fontSize: 14, color: "#555" }}>
                            {missingFields.join(" • ")}
                        </div>
                        <button
                            onClick={handleContinue}
                            disabled={!canContinue}
                            style={{
                                padding: "10px 18px",
                                fontSize: "16px",
                                cursor: canContinue
                                    ? "pointer"
                                    : "not-allowed",
                                backgroundColor: canContinue
                                    ? "#0366d6"
                                    : "#e9ecef",
                                border:
                                    "1px solid " +
                                    (canContinue ? "#0366d6" : "#ddd"),
                                borderRadius: "6px",
                                color: canContinue ? "#fff" : "#777",
                                fontWeight: 700,
                            }}
                        >
                            Continue
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
