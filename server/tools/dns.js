"use strict";


export const isPrivateIp = (ip) => {
    return (
        ip.startsWith("127.") ||
        ip.startsWith("10.") ||
        ip.startsWith("192.168.") ||
        ip.startsWith("169.254.") ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
        ip === "::1" ||
        ip.startsWith("fc") ||
        ip.startsWith("fd") ||
        ip.startsWith("fe80")
    );
}