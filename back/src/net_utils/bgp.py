from ipmininet.ipnet import IPNet

def setup_bgp(net: IPNet, nodes: list) -> None:
    for node in nodes:
        if node.config.type == "router" and node.config.bgp is not None:
            router = net.get(node.data.id)
            bgp_config = node.config.bgp 

            router.cmd(f"ip addr add {bgp_config.router_id}/32 dev eth0")

            config_lines = [
                f"router bgp {bgp_config.local_asn}",
                f" bgp router-id {bgp_config.router_id}",
                " no bgp ebgp-requires-policy",
                " bgp bestpath as-path multipath-relax",
                " bgp deterministic-med"
            ]

            for nb in bgp_config.neighbors:
                config_lines.append(f"  neighbor {nb.ip} remote-as {nb.remote_as}")

                if nb.weight is not None:
                    config_lines.append(f"  neighbor {nb.ip} weight {nb.weight}")

                config_lines.append(f"  neighbor {nb.ip} activate")
            
            for net_addr in bgp_config.networks:
                config_lines.append(f"  network {net_addr}")

            config_lines.append("  redistribute connected")
            config_lines.append(" exit-address-family")
            config_lines.append("!")

            config_text = "\n".join(config_lines)
            config_path = f"/tmp/bgpd_{router.name}.conf"

            router.cmd(f"cat <<EOF > {config_path}\n{config_text}\nEOF")
            router.cmd("/usr/lib/frr/zebra -d")
            router.cmd(f"/usr/lib/frr/bgpd -d -f {config_path}")
