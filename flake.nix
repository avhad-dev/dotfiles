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
        version = "1.1.13";

        src = pkgs.fetchurl {
          url = "https://github.com/google-antigravity/antigravity-cli/releases/download/${finalAttrs.version}/agy_cli_linux_arm64.tar.gz";
          hash = "sha512-0vNkKHPjKDJl6/TU4syMNlLf9aCxk6M+v+Dd7WhSHdArTCjtkv9UeE9qYmfpXIB7TYGU6KbWGdQ0hjirXIENRA==";
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
