{
  description = "Kuro AI dotfiles and coding harnesses";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

  outputs =
    { nixpkgs, ... }:
    let
      system = "aarch64-linux";
      pkgs = import nixpkgs { inherit system; };
      antigravityCli = pkgs.stdenv.mkDerivation (finalAttrs: {
        pname = "antigravity-cli";
        version = "1.1.10";

        src = pkgs.fetchurl {
          url = "https://storage.googleapis.com/antigravity-public/antigravity-cli/${finalAttrs.version}-6423386432339968/linux-arm/cli_linux_arm64.tar.gz";
          hash = "sha512-LWTE4J6yLIJLwpjKYeSMsOYmiDU9tBIplrLku6jJoVcNLL9uZFLtfvMN8JQL+PBYeJ5Gau1SZMGuLkYT7KW1cw==";
        };

        dontUnpack = true;
        nativeBuildInputs = [ pkgs.autoPatchelfHook ];

        installPhase = ''
          runHook preInstall

          tar -xzf "$src"
          install -Dm755 antigravity "$out/bin/agy"

          runHook postInstall
        '';

        meta.mainProgram = "agy";
      });
    in
    {
      packages.${system}.antigravity-cli = antigravityCli;

      devShells.${system}.default = pkgs.mkShell {
        packages = [
          antigravityCli
          pkgs.nodejs_22
          pkgs.git
        ];
      };
    };
}
