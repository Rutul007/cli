export let dockerComposeAcr: string = '';
export let acrTokenName: string = '';

export const setDockerComposeAcr = (value: string): void => {
    dockerComposeAcr = value;
};

export const setAcrTokenName = (value: string): void => {
    acrTokenName = value;
};