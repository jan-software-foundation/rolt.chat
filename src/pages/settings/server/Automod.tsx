/* eslint-disable react/jsx-no-literals */
import { Message } from "revolt.js";
import { ulid } from "ulid";

import { useCallback, useState } from "preact/hooks";

import { Button, Tip } from "@revoltchat/ui";

import { useApplicationState } from "../../../mobx/State";

import { useClient } from "../../../controllers/client/ClientController";

const AUTOMOD_USER_ID = "01FHGJ3NPP7XANQQH8C2BE44ZY";

export default function Automod(props: { server: string }) {
    const state = useApplicationState();
    const client = useClient();
    const [showWarning, setShowWarning] = useState(
        !state.settings.get("automod:confirmedWarning"),
    );
    const [token, setToken] = useState(state.settings.get("automod:apiToken"));

    const disconnect = useCallback(async () => {
        setShowWarning(true);
        setToken(undefined);
        state.settings.set("automod:apiToken", undefined);
        state.settings.set("automod:confirmedWarning", false);

        // todo: revoke the session token
    }, [state.settings]);

    const requestToken = useCallback(
        () =>
            // eslint-disable-next-line no-async-promise-executor
            new Promise<string>(async (resolve, reject) => {
                const automodUser =
                    client.users.get(AUTOMOD_USER_ID) ||
                    (await client.users.fetch(AUTOMOD_USER_ID));

                const dmChannel = await automodUser.openDM();

                const msg = await dmChannel.sendMessage({
                    content: "Requesting session token.",
                    // We don't want users to be able to request session tokens via
                    // DMs, since this would probably lead to phishing attacks and similar.
                    // Therefore, AutoMod only honors these requests when the nonce is
                    // prefixed with `REQUEST_SESSION_TOKEN-`.
                    nonce: `REQUEST_SESSION_TOKEN-${ulid()}`,
                });

                const onMessage = (message: Message) => {
                    if (
                        message.author_id == AUTOMOD_USER_ID &&
                        message.channel_id == dmChannel._id &&
                        message.reply_ids?.[0] == msg._id
                    ) {
                        client.removeListener("message", onMessage);
                        const token = message.nonce
                            ?.match(/TOKEN:.+/)?.[0]
                            ?.substring("TOKEN:".length);

                        if (!token) return reject("Did not receive a token");
                        resolve(token);
                    }
                };
                client.on("message", onMessage);
            }),
        [client],
    );

    return showWarning ? (
        <>
            <Tip palette="primary">
                When you click continue, a message will be sent on your behalf
                in order to authenticate to AutoMod.
                <Button
                    palette="secondary"
                    onClick={async () => {
                        setShowWarning(false);
                        const token = await requestToken();
                        setToken(token);
                        state.settings.set("automod:apiToken", token);
                        state.settings.set("automod:confirmedWarning", true);
                    }}>
                    Continue
                </Button>
            </Tip>
        </>
    ) : token ? (
        <>
            {" "}
            <iframe
                src={`https://automod.me/dashboard/${
                    props.server
                }?embedded=1&setAuth=${encodeURIComponent(
                    client.user!._id,
                )}:${encodeURIComponent(token)}`}
                style={{
                    width: "100%",
                    height: "100%",
                    border: "0",
                }}
            />
            <Button
                palette="plain-secondary"
                style={{ width: "100px" }}
                onClick={disconnect}>
                Disconnect
            </Button>
        </>
    ) : (
        <Button palette="secondary" onClick={disconnect}>
            Disconnect
        </Button>
    );
}
