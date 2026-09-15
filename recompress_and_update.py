import os
import json
import hashlib
import zstandard
import shutil

# Rutas a los directorios y archivos
PUBLISH_FILES_DIR = r"c:\Archivos\SAMSA_KASHRAMPAGEEXTREME\stake-math-sdk\games\kash_rampage_extreme\library\publish_files"
BUILD_FILES_DIR = r"c:\Archivos\SAMSA_KASHRAMPAGEEXTREME\BUILD\math_kash_rampage_extreme"
CONFIG_FILE = r"c:\Archivos\SAMSA_KASHRAMPAGEEXTREME\stake-math-sdk\games\kash_rampage_extreme\library\configs\config.json"

# Parámetros óptimos encontrados (Nivel 19, Ventana 2MB)
ZSTD_LEVEL = 19
ZSTD_WINDOW_LOG = 21

def get_sha256(filepath):
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(65536), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def recompress_zst(filepath):
    print(f"Recomprimiendo: {filepath}")
    temp_path = filepath + ".tmp"
    
    dctx = zstandard.ZstdDecompressor()
    cctx = zstandard.ZstdCompressor(level=ZSTD_LEVEL, window_log=ZSTD_WINDOW_LOG)
    
    with open(filepath, 'rb') as f_in, open(temp_path, 'wb') as f_out:
        with dctx.stream_reader(f_in) as reader:
            with cctx.stream_writer(f_out) as writer:
                while True:
                    chunk = reader.read(1024 * 1024) # Leer en chunks de 1MB
                    if not chunk:
                        break
                    writer.write(chunk)
                    
    # Reemplazar el archivo original con la nueva versión
    os.replace(temp_path, filepath)
    new_sha256 = get_sha256(filepath)
    print(f"OK. Nuevo SHA-256: {new_sha256}")
    return new_sha256

def update_config_file(filepath, hashes_map):
    print(f"\nActualizando hashes en: {filepath}")
    with open(filepath, 'r', encoding='utf-8') as f:
        config = json.load(f)
        
    updated = False
    if "bookShelfConfig" in config:
        for book_config in config["bookShelfConfig"]:
            if "booksFile" in book_config:
                filename = book_config["booksFile"]["file"]
                if filename in hashes_map:
                    book_config["booksFile"]["sha256"] = hashes_map[filename]
                    updated = True
                    
    if updated:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=4)
        print("config.json actualizado exitosamente.")
    else:
        print("No se requirieron actualizaciones en config.json.")

def main():
    files_to_recompress = [
        "books_base.jsonl.zst",
        "books_rage_mode.jsonl.zst",
        "books_smash_mode.jsonl.zst",
        "books_vault_crack.jsonl.zst"
    ]
    
    new_hashes = {}
    
    # Procesar archivos en el directorio de publish_files
    for filename in files_to_recompress:
        file_path = os.path.join(PUBLISH_FILES_DIR, filename)
        if os.path.exists(file_path):
            new_sha = recompress_zst(file_path)
            new_hashes[filename] = new_sha
            
            # Sincronizar también con la carpeta BUILD para que estén idénticos
            build_file_path = os.path.join(BUILD_FILES_DIR, filename)
            if os.path.exists(build_file_path):
                shutil.copy2(file_path, build_file_path)
                print(f"Copiado actualizado a carpeta BUILD: {build_file_path}")

    # Actualizar config.json con los nuevos SHA256
    if new_hashes:
        update_config_file(CONFIG_FILE, new_hashes)

if __name__ == "__main__":
    main()
