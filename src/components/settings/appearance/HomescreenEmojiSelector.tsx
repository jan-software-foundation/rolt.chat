import { InfoCircle } from "@styled-icons/boxicons-solid";

import { FC, useState } from "preact/compat";

import { Button, InputBox, Tooltip } from "@revoltchat/ui";

import { state, useApplicationState } from "../../../mobx/State";

import Emoji from "../../common/Emoji";
import Markdown from "../../markdown/Markdown";

export default function HomescreenEmojiSelector() {
    const settings = useApplicationState().settings;
    const [count, setCount] = useState(
        settings.get("appearance:homescreen:snowflake_count"),
    );
    const [entries, setEntries] = useState(
        settings.get("appearance:homescreen:snowflakes"),
    );

    return (
        <>
            <h3>
                Homescreen snowflakes{" "}
                <Tooltip
                    content={
                        <div>
                            {"Use custom emojis (or arbitrary text) instead of the default seasonal ones on the home screen." +
                                "You can input any text and it will be formatted just like a chat message. For example, to print "}
                            <Emoji emoji="custom:trol.png" size={16} />
                            {", type "}
                            <code>{":trol:"}</code>
                            {"."}
                        </div>
                    }
                    placement="right">
                    <InfoCircle size={16} />
                </Tooltip>
            </h3>
            <InputBox
                type="number"
                style={{
                    marginBottom: "8px",
                    width: "128px",
                }}
                placeholder="2"
                value={count}
                onChange={(e) => {
                    if (Number(e.currentTarget.value) >= 0) {
                        setCount(Number(e.currentTarget.value));
                        state.settings.set(
                            "appearance:homescreen:snowflake_count",
                            Number(e.currentTarget.value),
                        );
                    }
                }}
            />{" "}
            <Tooltip
                content="Set the amount of snowflakes spawned. Larger numbers might not have a visible effect."
                placement="right">
                <InfoCircle size={16} />
            </Tooltip>
            {entries?.map((e, i) => (
                <EmojiSlot
                    content={e}
                    index={i}
                    key={i}
                    onUpdate={() =>
                        setEntries(
                            settings.get("appearance:homescreen:snowflakes"),
                        )
                    }
                />
            ))}
            <Button
                onClick={() => {
                    settings.set("appearance:homescreen:snowflakes", [
                        ...(entries ?? []),
                        "",
                    ]);
                    setEntries(
                        settings.get("appearance:homescreen:snowflakes"),
                    );
                }}
                style={{ marginBottom: "4px" }}
                palette="secondary">
                +
            </Button>
        </>
    );
}

const EmojiSlot: FC<{ content: string; index: number; onUpdate: () => any }> = (
    data,
) => {
    const settings = useApplicationState().settings;
    const [content, setContent] = useState(data.content);
    const [editing, setEditing] = useState(false);

    return editing ? (
        <div style={{ display: "flex", justifyContent: "space-evenly" }}>
            <InputBox
                value={content}
                placeholder="Insert markdown-formatted text"
                onChange={(e) => setContent(e.currentTarget.value)}
                style={{ marginBottom: "4px", marginRight: "8px" }}
                palette="secondary"
            />
            <Button
                onClick={() => {
                    settings.set(
                        "appearance:homescreen:snowflakes",
                        settings
                            .get("appearance:homescreen:snowflakes")
                            ?.map((d, i) => (i == data.index ? content : d)),
                    );
                    setEditing(false);
                    data.onUpdate();
                }}
                style={{ width: "48px" }}
                palette="secondary">
                Save
            </Button>
        </div>
    ) : (
        <div style={{ display: "flex", justifyContent: "space-evenly" }}>
            <Button
                onClick={() => setEditing(true)}
                style={{
                    width: "calc(100% - 104px)",
                    justifyContent: "flex-start",
                    marginRight: "8px",
                    marginBottom: "4px",
                }}
                palette="secondary">
                {content ? <Markdown content={content} /> : "Click to edit"}
            </Button>
            <Button
                onClick={() => {
                    settings.set(
                        "appearance:homescreen:snowflakes",
                        settings
                            .get("appearance:homescreen:snowflakes")
                            ?.filter((_, i) => i != data.index),
                    );
                    data.onUpdate();
                }}
                style={{ width: "48px" }}
                palette="secondary">
                Delete
            </Button>
        </div>
    );
};
