import { ChevronRight, Trash } from "@styled-icons/boxicons-regular";
import { Cog, UserVoice } from "@styled-icons/boxicons-solid";
import { isFirefox } from "react-device-detect";
import { useHistory } from "react-router-dom";
import {
    Channel,
    Message,
    Server,
    User,
    API,
    Permission,
    UserPermission,
    Member,
} from "revolt.js";

import {
    ContextMenuWithData,
    MenuItem,
    openContextMenu,
} from "preact-context-menu";
import { Text } from "preact-i18n";

import { IconButton, LineDivider } from "@revoltchat/ui";

import { useApplicationState } from "../mobx/State";
import { QueuedMessage } from "../mobx/stores/MessageQueue";
import { NotificationState } from "../mobx/stores/NotificationOptions";

import CMNotifications from "./contextmenu/CMNotifications";

import Tooltip from "../components/common/Tooltip";
import UserStatus from "../components/common/user/UserStatus";
import { useSession } from "../controllers/client/ClientController";
import { takeError } from "../controllers/client/jsx/error";
import { modalController } from "../controllers/modals/ModalController";
import { internalEmit } from "./eventEmitter";
import { getRenderer } from "./renderer/Singleton";

const CHANNEL_TERM = "01FQWFG5ZJPNBSCWQ58V5TWM0X";
const CHANNEL_BLACKLIST = "01G2P6WK74JSEP39RX1CK2G6RN";

interface ContextMenuData {
    user?: string;
    server?: string;
    server_list?: string;
    channel?: string;
    message?: Message;
    attachment?: API.File;

    unread?: boolean;
    queued?: QueuedMessage;
    contextualChannel?: string;
}

type Action =
    | { action: "copy_id"; id: string }
    | { action: "copy_message_link"; message: Message }
    | { action: "copy_selection" }
    | { action: "copy_text"; content: string }
    | { action: "mark_as_read"; channel: Channel }
    | { action: "mark_server_as_read"; server: Server }
    | { action: "mark_unread"; message: Message }
    | { action: "retry_message"; message: QueuedMessage }
    | { action: "cancel_message"; message: QueuedMessage }
    | { action: "mention"; user: string }
    | { action: "reply_message"; target: Message }
    | { action: "quote_message"; content: string }
    | { action: "edit_message"; id: string }
    | { action: "delete_message"; target: Message }
    | { action: "open_file"; attachment: API.File }
    | { action: "save_file"; attachment: API.File }
    | { action: "copy_file_link"; attachment: API.File }
    | { action: "open_link"; link: string }
    | { action: "copy_link"; link: string }
    | { action: "make_owner"; channel: Channel; user: User }
    | { action: "remove_member"; channel: Channel; user: User }
    | { action: "kick_member"; target: Member }
    | { action: "ban_member"; target: Member }
    | { action: "view_profile"; user: User }
    | { action: "message_user"; user: User }
    | { action: "block_user"; user: User }
    | { action: "unblock_user"; user: User }
    | { action: "term_user"; user: User }
    | { action: "blacklist_user"; user: User }
    | { action: "unblacklist_user"; user: User }
    | { action: "add_friend"; user: User }
    | { action: "remove_friend"; user: User }
    | { action: "cancel_friend"; user: User }
    | { action: "set_presence"; presence: API.Presence }
    | { action: "set_status" }
    | { action: "clear_status" }
    | { action: "create_channel"; target: Server }
    | { action: "create_category"; target: Server }
    | {
          action: "create_invite";
          target: Channel;
      }
    | { action: "leave_group"; target: Channel }
    | {
          action: "delete_channel";
          target: Channel;
      }
    | { action: "close_dm"; target: Channel }
    | { action: "leave_server"; target: Server }
    | { action: "delete_server"; target: Server }
    | { action: "edit_identity"; target: Member }
    | {
          action: "open_notification_options";
          channel?: Channel;
          server?: Server;
      }
    | { action: "open_settings" }
    | { action: "open_channel_settings"; id: string }
    | { action: "open_server_settings"; id: string }
    | { action: "open_server_channel_settings"; server: string; id: string }
    | {
          action: "set_notification_state";
          key: string;
          state?: NotificationState;
      };

// ! FIXME: I dare someone to re-write this
// Tip: This should just be split into separate context menus per logical area.
export default function ContextMenus() {
    const session = useSession()!;
    const client = session.client!;
    const userId = client.user!._id;
    const state = useApplicationState();
    const history = useHistory();
    const isOnline = session.state === "Online";

    function contextClick(data?: Action) {
        if (typeof data === "undefined") return;

        (async () => {
            switch (data.action) {
                case "copy_id":
                    modalController.writeText(data.id);
                    break;
                case "copy_message_link":
                    {
                        let pathname = `/channel/${data.message.channel_id}/${data.message._id}`;
                        const channel = data.message.channel;
                        if (channel?.channel_type === "TextChannel")
                            pathname = `/server/${channel.server_id}${pathname}`;

                        modalController.writeText(window.origin + pathname);
                    }
                    break;
                case "copy_selection":
                    modalController.writeText(
                        document.getSelection()?.toString() ?? "",
                    );
                    break;
                case "mark_as_read":
                    {
                        if (
                            data.channel.channel_type === "SavedMessages" ||
                            data.channel.channel_type === "VoiceChannel"
                        )
                            return;

                        client.unreads!.markRead(
                            data.channel._id,
                            data.channel.last_message_id!,
                            true,
                            true,
                        );
                    }
                    break;
                case "mark_server_as_read":
                    {
                        client.unreads!.markMultipleRead(
                            data.server.channel_ids,
                        );

                        data.server.ack();
                    }
                    break;

                case "mark_unread":
                    {
                        const messages = getRenderer(
                            data.message.channel!,
                        ).messages;
                        const index = messages.findIndex(
                            (x) => x._id === data.message._id,
                        );

                        let unread_id = data.message._id;
                        if (index > 0) {
                            unread_id = messages[index - 1]._id;
                        }

                        internalEmit("NewMessages", "mark", unread_id);
                        data.message.channel?.ack(unread_id, true);
                    }
                    break;

                case "retry_message":
                    {
                        const nonce = data.message.id;
                        const fail = (error: string) =>
                            state.queue.fail(nonce, error);

                        client.channels
                            .get(data.message.channel)!
                            .sendMessage({
                                nonce: data.message.id,
                                content: data.message.data.content,
                                replies: data.message.data.replies,
                            })
                            .catch(fail);

                        state.queue.start(nonce);
                    }
                    break;

                case "cancel_message":
                    {
                        state.queue.remove(data.message.id);
                    }
                    break;

                case "mention":
                    {
                        internalEmit(
                            "MessageBox",
                            "append",
                            `<@${data.user}>`,
                            "mention",
                        );
                    }
                    break;

                case "copy_text":
                    modalController.writeText(data.content);
                    break;

                case "reply_message":
                    {
                        internalEmit("ReplyBar", "add", data.target);
                    }
                    break;

                case "quote_message":
                    {
                        internalEmit(
                            "MessageBox",
                            "append",
                            data.content,
                            "quote",
                        );
                    }
                    break;

                case "edit_message":
                    {
                        internalEmit(
                            "MessageRenderer",
                            "edit_message",
                            data.id,
                        );
                    }
                    break;

                case "open_file":
                    {
                        window
                            .open(
                                client.generateFileURL(data.attachment),
                                "_blank",
                            )
                            ?.focus();
                    }
                    break;

                case "save_file":
                    {
                        window.open(
                            // ! FIXME: do this from revolt.js
                            client
                                .generateFileURL(data.attachment)
                                ?.replace(
                                    "attachments",
                                    "attachments/download",
                                ),
                            isFirefox || window.native ? "_blank" : "_self",
                        );
                    }
                    break;

                case "copy_file_link":
                    {
                        const { filename } = data.attachment;
                        modalController.writeText(
                            // ! FIXME: do from r.js
                            `${client.generateFileURL(
                                data.attachment,
                            )}/${encodeURI(filename)}`,
                        );
                    }
                    break;

                case "open_link":
                    {
                        window.open(data.link, "_blank")?.focus();
                    }
                    break;

                case "copy_link":
                    {
                        modalController.writeText(data.link);
                    }
                    break;

                case "make_owner":
                    {
                        // FIXME: add a modal for this
                        data.channel.edit({
                            owner: data.user._id,
                        });
                    }
                    break;

                case "remove_member":
                    {
                        data.channel.removeMember(data.user._id);
                    }
                    break;

                case "view_profile":
                    modalController.push({
                        type: "user_profile",
                        user_id: data.user._id,
                    });
                    break;

                case "message_user":
                    {
                        const channel = await data.user.openDM();
                        if (channel) {
                            history.push(`/channel/${channel._id}`);
                        }
                    }
                    break;

                case "add_friend":
                    {
                        await data.user.addFriend();
                    }
                    break;

                case "block_user":
                    modalController.push({
                        type: "block_user",
                        target: data.user,
                    });
                    break;
                case "unblock_user":
                    await data.user.unblockUser();
                    break;
                case "remove_friend":
                    modalController.push({
                        type: "unfriend_user",
                        target: data.user,
                    });
                    break;
                case "cancel_friend":
                    await data.user.removeFriend();
                    break;

                case "set_presence":
                    {
                        await client.users.edit({
                            status: {
                                ...client.user?.status,
                                presence: data.presence,
                            },
                        });
                    }
                    break;

                case "term_user":
                    {
                        modalController.push({
                            type: "platform_moderation_confirm",
                            target: data.user,
                            action: "term",
                        });
                    }
                    break;

                case "blacklist_user":
                    {
                        modalController.push({
                            type: "platform_moderation_confirm",
                            target: data.user,
                            action: "blacklist",
                        });
                    }
                    break;

                case "unblacklist_user":
                    {
                        modalController.push({
                            type: "platform_moderation_confirm",
                            target: data.user,
                            action: "unblacklist",
                        });
                    }
                    break;

                case "set_status":
                    modalController.push({
                        type: "custom_status",
                    });
                    break;

                case "clear_status":
                    await client.users.edit({ remove: ["StatusText"] });
                    break;

                case "delete_message":
                    modalController.push({
                        type: "delete_message",
                        target: data.target,
                    });
                    break;

                case "leave_group":
                case "close_dm":
                case "delete_channel":
                case "create_invite":
                    modalController.push({
                        type: data.action,
                        target: data.target,
                    });
                    break;

                case "leave_server":
                case "delete_server":
                case "create_channel":
                case "create_category":
                    modalController.push({
                        type: data.action,
                        target: data.target,
                    });
                    break;

                case "edit_identity":
                    modalController.push({
                        type: "server_identity",
                        member: data.target,
                    });
                    break;

                case "ban_member":
                case "kick_member":
                    modalController.push({
                        type: data.action,
                        member: data.target,
                    });
                    break;

                case "open_notification_options": {
                    openContextMenu("NotificationOptions", {
                        channel: data.channel,
                        server: data.server,
                    });
                    break;
                }

                case "open_settings":
                    history.push("/settings");
                    break;
                case "open_channel_settings":
                    history.push(`/channel/${data.id}/settings`);
                    break;
                case "open_server_channel_settings":
                    history.push(
                        `/server/${data.server}/channel/${data.id}/settings`,
                    );
                    break;
                case "open_server_settings":
                    history.push(`/server/${data.id}/settings`);
                    break;
            }
        })().catch((err) => {
            modalController.push({
                type: "error",
                error: takeError(err),
            });
        });
    }

    return (
        <>
            <ContextMenuWithData id="Menu" onClose={contextClick}>
                {({
                    user: uid,
                    channel: cid,
                    server: sid,
                    message,
                    attachment,
                    server_list,
                    queued,
                    unread,
                    contextualChannel: cxid,
                }: ContextMenuData) => {
                    const elements: Children[] = [];
                    let lastDivider = false;

                    function generateAction(
                        action: Action,
                        locale?: string,
                        disabled?: boolean,
                        tip?: Children,
                        color?: string,
                    ) {
                        lastDivider = false;
                        elements.push(
                            <MenuItem data={action} disabled={disabled}>
                                <span style={{ color }}>
                                    <Text
                                        id={`app.context_menu.${
                                            locale ?? action.action
                                        }`}
                                    />
                                </span>
                                {tip && <div className="tip">{tip}</div>}
                            </MenuItem>,
                        );
                    }

                    function pushDivider() {
                        if (lastDivider || elements.length === 0) return;
                        lastDivider = true;
                        elements.push(<LineDivider compact />);
                    }

                    if (server_list) {
                        const server = client.servers.get(server_list)!;
                        if (server) {
                            if (server.havePermission("ManageChannel")) {
                                generateAction({
                                    action: "create_category",
                                    target: server,
                                });
                                generateAction({
                                    action: "create_channel",
                                    target: server,
                                });
                            }

                            if (server.havePermission("ManageServer"))
                                generateAction({
                                    action: "open_server_settings",
                                    id: server_list,
                                });
                        }

                        return elements;
                    }

                    if (document.getSelection()?.toString().length ?? 0 > 0) {
                        generateAction(
                            { action: "copy_selection" },
                            undefined,
                            undefined,
                            <Text id="shortcuts.ctrlc" />,
                        );
                        pushDivider();
                    }

                    const channel = cid ? client.channels.get(cid) : undefined;
                    const contextualChannel = cxid
                        ? client.channels.get(cxid)
                        : undefined;
                    const targetChannel = channel ?? contextualChannel;

                    const user = uid ? client.users.get(uid) : undefined;
                    const serverChannel =
                        targetChannel &&
                        (targetChannel.channel_type === "TextChannel" ||
                            targetChannel.channel_type === "VoiceChannel")
                            ? targetChannel
                            : undefined;

                    const s = serverChannel ? serverChannel.server_id! : sid;
                    const server = s ? client.servers.get(s) : undefined;

                    const channelPermissions = targetChannel?.permission || 0;
                    const serverPermissions =
                        (server
                            ? server.permission
                            : serverChannel
                            ? serverChannel.server?.permission
                            : 0) || 0;
                    const userPermissions = (user ? user.permission : 0) || 0;

                    if (unread) {
                        if (channel) {
                            generateAction({ action: "mark_as_read", channel });
                        } else if (server) {
                            generateAction(
                                {
                                    action: "mark_server_as_read",
                                    server,
                                },
                                "mark_as_read",
                            );
                        }
                    }

                    if (contextualChannel) {
                        if (user && user._id !== userId) {
                            generateAction({
                                action: "mention",
                                user: user._id,
                            });

                            pushDivider();
                        }
                    }

                    if (user) {
                        let actions: (Action["action"] | boolean)[];
                        switch (user.relationship) {
                            case "User":
                                actions = [];
                                break;
                            case "Friend":
                                actions = [
                                    !user.bot && "remove_friend",
                                    "block_user",
                                ];
                                break;
                            case "Incoming":
                                actions = [
                                    "add_friend",
                                    "cancel_friend",
                                    "block_user",
                                ];
                                break;
                            case "Outgoing":
                                actions = [
                                    !user.bot && "cancel_friend",
                                    "block_user",
                                ];
                                break;
                            case "Blocked":
                                actions = ["unblock_user"];
                                break;
                            case "BlockedOther":
                                actions = ["block_user"];
                                break;
                            case "None":
                            default:
                                if ((user.flags && 2) || (user.flags && 4)) {
                                    actions = ["block_user"];
                                } else {
                                    actions = [
                                        !user.bot && "add_friend",
                                        "block_user",
                                    ];
                                }
                        }

                        if (userPermissions & UserPermission.ViewProfile) {
                            generateAction({
                                action: "view_profile",
                                user,
                            });
                        }

                        if (user._id !== userId) {
                            if (userPermissions & UserPermission.SendMessage) {
                                generateAction({
                                    action: "message_user",
                                    user,
                                });
                            } else {
                                elements.push(
                                    <MenuItem disabled={true}>
                                        <Tooltip
                                            content="Must be friends with this user to message them."
                                            placement="left"
                                            hideOnClick={false}>
                                            <Text
                                                id={`app.context_menu.message_user`}
                                            />
                                        </Tooltip>
                                    </MenuItem>,
                                );
                            }
                        }

                        for (let i = 0; i < actions.length; i++) {
                            const action = actions[i];
                            if (action) {
                                generateAction({
                                    action,
                                    user,
                                } as unknown as Action);
                            }
                        }

                        if (
                            state.experiments.isEnabled("platform-moderation")
                        ) {
                            if (client.channels.get(CHANNEL_TERM))
                                elements.push(
                                    <MenuItem
                                        data={
                                            {
                                                action: "term_user",
                                                user,
                                            } as Action
                                        }>
                                        {/* eslint-disable-next-line react/jsx-no-literals */}
                                        <span style={{ color: "var(--error)" }}>
                                            Terminate
                                        </span>
                                    </MenuItem>,
                                );

                            if (client.channels.get(CHANNEL_BLACKLIST)) {
                                elements.push(
                                    <MenuItem
                                        data={
                                            {
                                                action: "blacklist_user",
                                                user,
                                            } as Action
                                        }>
                                        {/* eslint-disable-next-line react/jsx-no-literals */}
                                        <span style={{ color: "var(--error)" }}>
                                            Blacklist
                                        </span>
                                    </MenuItem>,
                                );
                                elements.push(
                                    <MenuItem
                                        data={
                                            {
                                                action: "unblacklist_user",
                                                user,
                                            } as Action
                                        }>
                                        {/* eslint-disable-next-line react/jsx-no-literals */}
                                        <span style={{ color: "var(--error)" }}>
                                            Unblacklist
                                        </span>
                                    </MenuItem>,
                                );
                            }
                        }
                    }

                    if (contextualChannel) {
                        if (contextualChannel.channel_type === "Group" && uid) {
                            if (
                                contextualChannel.owner_id === userId &&
                                userId !== uid
                            ) {
                                generateAction(
                                    {
                                        action: "make_owner",
                                        channel: contextualChannel,
                                        user: user!,
                                    },
                                    undefined,
                                    false,
                                    undefined,
                                    "var(--error)",
                                );

                                generateAction(
                                    {
                                        action: "remove_member",
                                        channel: contextualChannel,
                                        user: user!,
                                    },
                                    undefined,
                                    false,
                                    undefined,
                                    "var(--error)",
                                );
                            }
                        }

                        if (
                            server &&
                            uid &&
                            userId !== uid &&
                            uid !== server.owner
                        ) {
                            const member = client.members.getKey({
                                server: server._id,
                                user: user!._id,
                            })!;

                            if (member) {
                                if (serverPermissions & Permission.KickMembers)
                                    generateAction(
                                        {
                                            action: "kick_member",
                                            target: member,
                                        },
                                        undefined, // this is needed because generateAction uses positional, not named parameters
                                        undefined,
                                        null,
                                        "var(--error)", // the only relevant part really
                                    );

                                if (serverPermissions & Permission.BanMembers)
                                    generateAction(
                                        {
                                            action: "ban_member",
                                            target: member,
                                        },
                                        undefined,
                                        undefined,
                                        null,
                                        "var(--error)",
                                    );
                            }
                        }
                    }

                    if (queued) {
                        generateAction({
                            action: "retry_message",
                            message: queued,
                        });

                        generateAction({
                            action: "cancel_message",
                            message: queued,
                        });
                    }

                    if (message && !queued) {
                        const sendPermission =
                            message.channel &&
                            message.channel.permission & Permission.SendMessage;

                        if (sendPermission) {
                            generateAction({
                                action: "reply_message",
                                target: message,
                            });
                        }

                        generateAction({
                            action: "mark_unread",
                            message,
                        });

                        if (
                            typeof message.content === "string" &&
                            message.content.length > 0
                        ) {
                            if (sendPermission) {
                                generateAction({
                                    action: "quote_message",
                                    content: message.content,
                                });
                            }

                            generateAction({
                                action: "copy_text",
                                content: message.content,
                            });
                        }

                        if (message.author_id === userId) {
                            generateAction({
                                action: "edit_message",
                                id: message._id,
                            });
                        }

                        if (
                            message.author_id === userId ||
                            channelPermissions & Permission.ManageMessages
                        ) {
                            generateAction({
                                action: "delete_message",
                                target: message,
                            });
                        }

                        if (
                            message.attachments &&
                            message.attachments.length == 1 // if there are multiple attachments, the individual ones have to be clicked
                        ) {
                            pushDivider();
                            const { metadata } = message.attachments[0];
                            const { type } = metadata;

                            generateAction(
                                {
                                    action: "open_file",
                                    attachment: message.attachments[0],
                                },
                                type === "Image"
                                    ? "open_image"
                                    : type === "Video"
                                    ? "open_video"
                                    : "open_file",
                            );

                            generateAction(
                                {
                                    action: "save_file",
                                    attachment: message.attachments[0],
                                },
                                type === "Image"
                                    ? "save_image"
                                    : type === "Video"
                                    ? "save_video"
                                    : "save_file",
                            );

                            generateAction(
                                {
                                    action: "copy_file_link",
                                    attachment: message.attachments[0],
                                },
                                "copy_link",
                            );
                        }

                        if (document.activeElement?.tagName === "A") {
                            const link =
                                document.activeElement.getAttribute("href");
                            if (link) {
                                pushDivider();
                                generateAction({ action: "open_link", link });
                                generateAction({ action: "copy_link", link });
                            }
                        }
                    }

                    if (attachment) {
                        pushDivider();
                        const { metadata } = attachment;
                        const { type } = metadata;

                        generateAction(
                            {
                                action: "open_file",
                                attachment,
                            },
                            type === "Image"
                                ? "open_image"
                                : type === "Video"
                                ? "open_video"
                                : "open_file",
                        );

                        generateAction(
                            {
                                action: "save_file",
                                attachment,
                            },
                            type === "Image"
                                ? "save_image"
                                : type === "Video"
                                ? "save_video"
                                : "save_file",
                        );

                        generateAction(
                            {
                                action: "copy_file_link",
                                attachment,
                            },
                            "copy_link",
                        );
                    }

                    const id = sid ?? cid ?? uid ?? message?._id;
                    if (id) {
                        pushDivider();

                        if (channel) {
                            if (channel.channel_type !== "VoiceChannel") {
                                generateAction(
                                    {
                                        action: "open_notification_options",
                                        channel,
                                    },
                                    undefined,
                                    undefined,
                                    <ChevronRight size={24} />,
                                );
                            }

                            switch (channel.channel_type) {
                                case "Group":
                                    // ! generateAction({ action: "create_invite", target: channel }); FIXME: add support for group invites
                                    generateAction(
                                        {
                                            action: "open_channel_settings",
                                            id: channel._id,
                                        },
                                        "open_group_settings",
                                    );
                                    generateAction(
                                        {
                                            action: "leave_group",
                                            target: channel,
                                        },
                                        "leave_group",
                                    );
                                    break;
                                case "DirectMessage":
                                    generateAction({
                                        action: "close_dm",
                                        target: channel,
                                    });
                                    break;
                                case "TextChannel":
                                case "VoiceChannel":
                                    if (
                                        channelPermissions &
                                        Permission.InviteOthers
                                    ) {
                                        generateAction({
                                            action: "create_invite",
                                            target: channel,
                                        });
                                    }

                                    if (
                                        serverPermissions &
                                        Permission.ManageServer
                                    )
                                        generateAction(
                                            {
                                                action: "open_server_channel_settings",
                                                server: channel.server_id!,
                                                id: channel._id,
                                            },
                                            "open_channel_settings",
                                        );

                                    if (
                                        serverPermissions &
                                        Permission.ManageChannel
                                    )
                                        generateAction({
                                            action: "delete_channel",
                                            target: channel,
                                        });

                                    break;
                            }
                        }

                        if (sid && server) {
                            generateAction(
                                {
                                    action: "open_notification_options",
                                    server,
                                },
                                undefined,
                                undefined,
                                <ChevronRight size={24} />,
                            );

                            if (server.channels[0] !== undefined)
                                generateAction(
                                    {
                                        action: "create_invite",
                                        target: server.channels[0],
                                    },
                                    "create_invite",
                                );

                            if (
                                serverPermissions & Permission.ChangeNickname ||
                                serverPermissions & Permission.ChangeAvatar
                            )
                                generateAction(
                                    {
                                        action: "edit_identity",
                                        target: server.member!,
                                    },
                                    "edit_identity",
                                );

                            if (serverPermissions & Permission.ManageServer)
                                generateAction(
                                    {
                                        action: "open_server_settings",
                                        id: server._id,
                                    },
                                    "open_server_settings",
                                );

                            if (userId === server.owner) {
                                generateAction(
                                    { action: "delete_server", target: server },
                                    "delete_server",
                                );
                            } else {
                                generateAction(
                                    { action: "leave_server", target: server },
                                    "leave_server",
                                );
                            }
                        }

                        if (message) {
                            generateAction({
                                action: "copy_message_link",
                                message,
                            });
                        }

                        generateAction(
                            { action: "copy_id", id },
                            sid
                                ? "copy_sid"
                                : cid
                                ? "copy_cid"
                                : message
                                ? "copy_mid"
                                : "copy_uid",
                        );
                    }

                    return elements;
                }}
            </ContextMenuWithData>
            <ContextMenuWithData
                id="Status"
                onClose={contextClick}
                className="Status">
                {() => {
                    const user = client.user!;
                    return (
                        <>
                            <div className="header">
                                <div className="main">
                                    <div
                                        className="username"
                                        onClick={() =>
                                            modalController.writeText(
                                                client.user!.username,
                                            )
                                        }>
                                        <Tooltip
                                            content={
                                                <Text id="app.special.copy_username" />
                                            }>
                                            @{user.username}
                                        </Tooltip>
                                    </div>
                                    <div
                                        className="status"
                                        onClick={() =>
                                            contextClick({
                                                action: "set_status",
                                            })
                                        }>
                                        <UserStatus user={user} />
                                    </div>
                                </div>
                                <IconButton>
                                    <MenuItem
                                        data={{ action: "open_settings" }}>
                                        <Cog size={22} />
                                    </MenuItem>
                                </IconButton>
                            </div>
                            <LineDivider compact />
                            <MenuItem
                                data={{
                                    action: "set_presence",
                                    presence: "Online",
                                }}
                                disabled={!isOnline}>
                                <div className="indicator online" />
                                <Text id={`app.status.online`} />
                            </MenuItem>
                            <MenuItem
                                data={{
                                    action: "set_presence",
                                    presence: "Idle",
                                }}
                                disabled={!isOnline}>
                                <div className="indicator idle" />
                                <Text id={`app.status.idle`} />
                            </MenuItem>
                            <MenuItem
                                data={{
                                    action: "set_presence",
                                    presence: "Focus",
                                }}
                                disabled={!isOnline}>
                                <div className="indicator focus" />
                                <Text id={`app.status.focus`} />
                            </MenuItem>
                            <MenuItem
                                data={{
                                    action: "set_presence",
                                    presence: "Busy",
                                }}
                                disabled={!isOnline}>
                                <div className="indicator busy" />
                                <Text id={`app.status.busy`} />
                            </MenuItem>
                            <MenuItem
                                data={{
                                    action: "set_presence",
                                    presence: "Invisible",
                                }}
                                disabled={!isOnline}>
                                <div className="indicator invisible" />
                                <Text id={`app.status.invisible`} />
                            </MenuItem>
                            <LineDivider compact />
                            <MenuItem
                                data={{ action: "set_status" }}
                                disabled={!isOnline}>
                                <UserVoice size={18} />
                                <Text id={`app.context_menu.custom_status`} />
                                {client.user!.status?.text && (
                                    <IconButton>
                                        <MenuItem
                                            data={{ action: "clear_status" }}>
                                            <Trash size={18} />
                                        </MenuItem>
                                    </IconButton>
                                )}
                            </MenuItem>
                        </>
                    );
                }}
            </ContextMenuWithData>
            <CMNotifications />
        </>
    );
}
