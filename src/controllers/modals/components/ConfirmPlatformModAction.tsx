import { Column, ModalForm } from "@revoltchat/ui";

import UserIcon from "../../../components/common/user/UserIcon";
import { useClient } from "../../client/ClientController";
import { ModalProps } from "../types";

const CHANNEL_TERM = "01FQWFG5ZJPNBSCWQ58V5TWM0X";
const CHANNEL_BLACKLIST = "01G2P6WK74JSEP39RX1CK2G6RN";

export default function ConfirmPlatformModAction({
    ...props
}: ModalProps<"platform_moderation_confirm">) {
    const client = useClient();

    return (
        <ModalForm
            {...props}
            title={`${
                props.action == "term"
                    ? "Terminate"
                    : props.action == "blacklist"
                    ? "Blacklist"
                    : "Unblacklist"
            } ${props.target.username}?`}
            schema={{
                member: "custom",
                reason: props.action == "blacklist" ? "text" : "custom",
            }}
            data={{
                member: {
                    element: (
                        <Column centred>
                            <UserIcon target={props.target} size={64} />
                        </Column>
                    ),
                },
                reason:
                    props.action == "blacklist"
                        ? ({ field: "Reason" } as any)
                        : { element: <></> },
            }}
            callback={async ({ reason }) => {
                if (props.action == "term") {
                    await client.channels
                        .get(CHANNEL_TERM)!
                        .sendMessage(`/term ${props.target._id}`);
                } else if (props.action == "blacklist") {
                    await client.channels
                        .get(CHANNEL_BLACKLIST)!
                        .sendMessage(`/botadm blacklist ${props.target._id}`);

                    if (reason) {
                        await client.channels
                            .get(CHANNEL_BLACKLIST)!
                            .sendMessage(
                                `/botadm blacklistreason ${props.target._id} ${reason}`,
                            );
                    }
                } else if (props.action == "unblacklist") {
                    await client.channels
                        .get(CHANNEL_BLACKLIST)!
                        .sendMessage(`/botadm unblacklist ${props.target._id}`);
                }
            }}
            submit={{
                palette: "error",
                children: "Confirm",
            }}
        />
    );
}
